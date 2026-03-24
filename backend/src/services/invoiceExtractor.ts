import fs from 'fs';
import path from 'path';

export interface ExtractedInvoiceData {
  amount?: number;
  date?: string;
  vendor?: string;
  documentNumber?: string;
  description?: string;
  rawText?: string;
}

// Extract text from PDF using pdf-parse
async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch {
    return '';
  }
}

// Pattern-based extraction from text
function parseInvoiceText(text: string): ExtractedInvoiceData {
  const result: ExtractedInvoiceData = { rawText: text.slice(0, 2000) };

  // Try to find monetary values - Brazilian format: R$ 1.234,56 or 1234.56
  const amountPatterns = [
    /(?:total|valor|amount|r\$)\s*[:\s]*R?\$?\s*([\d.,]+)/gi,
    /R\$\s*([\d.,]+)/g,
    /(?:total|subtotal)\s*[:\s]*([\d.,]+)/gi,
  ];

  for (const pattern of amountPatterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const raw = lastMatch[1].replace(/\./g, '').replace(',', '.');
      const value = parseFloat(raw);
      if (!isNaN(value) && value > 0) {
        result.amount = value;
        break;
      }
    }
  }

  // Date patterns - DD/MM/YYYY or YYYY-MM-DD
  const datePatterns = [
    /(?:data|date|emissão|emissao|competência)[\s:]*(\d{2}\/\d{2}\/\d{4})/gi,
    /(\d{2}\/\d{2}\/\d{4})/g,
    /(\d{4}-\d{2}-\d{2})/g,
  ];

  for (const pattern of datePatterns) {
    const match = pattern.exec(text);
    if (match) {
      const dateStr = match[1];
      // Convert DD/MM/YYYY to YYYY-MM-DD
      if (dateStr.includes('/')) {
        const [d, m, y] = dateStr.split('/');
        result.date = `${y}-${m}-${d}`;
      } else {
        result.date = dateStr;
      }
      break;
    }
  }

  // Document number (NF, NFS-e, Nota Fiscal, invoice)
  const docPatterns = [
    /(?:nf-e|nota fiscal|nfs-e|invoice|n[uú]mero)[^\d]*([\d.-]+)/gi,
    /n[º°]?\s*([\d]+)/gi,
  ];

  for (const pattern of docPatterns) {
    const match = pattern.exec(text);
    if (match) {
      result.documentNumber = match[1].trim();
      break;
    }
  }

  // Vendor/company name
  const vendorPatterns = [
    /(?:prestador|fornecedor|empresa|razão social|nome)[:\s]+([A-ZÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÇ][^\n,;]{3,50})/gi,
    /cnpj[:\s]+[\d./-]+[\s\n]+([A-Z][^\n]{3,50})/gi,
  ];

  for (const pattern of vendorPatterns) {
    const match = pattern.exec(text);
    if (match) {
      result.vendor = match[1].trim().slice(0, 100);
      break;
    }
  }

  // Description
  const descPatterns = [
    /(?:serviço|service|discriminação|descrição|objeto)[:\s]+([^\n]{5,100})/gi,
  ];
  for (const pattern of descPatterns) {
    const match = pattern.exec(text);
    if (match) {
      result.description = match[1].trim().slice(0, 200);
      break;
    }
  }

  return result;
}

export async function extractInvoiceData(filePath: string, mimeType: string): Promise<ExtractedInvoiceData> {
  try {
    let text = '';

    if (mimeType === 'application/pdf' || filePath.toLowerCase().endsWith('.pdf')) {
      text = await extractTextFromPDF(filePath);
    } else if (mimeType?.startsWith('image/') || /\.(png|jpg|jpeg|gif|bmp|tiff?)$/i.test(filePath)) {
      // For images, return empty data (OCR would require additional setup)
      return {
        rawText: 'Imagem enviada. Por favor, preencha os dados manualmente.',
      };
    } else if (mimeType === 'text/plain' || filePath.endsWith('.txt')) {
      text = fs.readFileSync(filePath, 'utf-8');
    }

    if (!text.trim()) {
      return { rawText: 'Não foi possível extrair texto do arquivo. Preencha manualmente.' };
    }

    return parseInvoiceText(text);
  } catch (err) {
    console.error('Invoice extraction error:', err);
    return {};
  }
}
