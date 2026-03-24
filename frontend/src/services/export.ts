import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Transaction } from '../types';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = (dateStr: string) => {
  try {
    return format(new Date(dateStr + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return dateStr;
  }
};

export function exportToExcel(
  transactions: Transaction[],
  filename: string = 'relatorio',
  summary?: { totalIncome: number; totalExpenses: number; balance: number }
) {
  const wb = XLSX.utils.book_new();

  // Transactions sheet
  const rows = transactions.map((t) => ({
    'Data': formatDate(t.date),
    'Tipo': t.type === 'income' ? 'Receita' : 'Despesa',
    'Projeto': t.project_name || '',
    'Categoria': t.category_name || '',
    'Descrição': t.description,
    'Fornecedor/Cliente': t.vendor || '',
    'Nº Documento': t.document_number || '',
    'Forma Pagamento': t.payment_method || '',
    'Valor (R$)': t.amount,
    'Observações': t.notes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 22 }, { wch: 35 },
    { wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Lançamentos');

  // Summary sheet
  if (summary) {
    const summaryData = [
      { 'Indicador': 'Total de Receitas', 'Valor (R$)': summary.totalIncome },
      { 'Indicador': 'Total de Despesas', 'Valor (R$)': summary.totalExpenses },
      { 'Indicador': 'Saldo', 'Valor (R$)': summary.balance },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 25 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');
  }

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToPDF(
  transactions: Transaction[],
  title: string = 'Relatório de Fluxo de Caixa',
  summary?: { totalIncome: number; totalExpenses: number; balance: number },
  projectName?: string
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, 297, 25, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('FluxoCaixa - Gestão Financeira de Obras', 148, 11, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 148, 19, { align: 'center' });

  // Project and date info
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  let yPos = 32;
  if (projectName) {
    doc.text(`Projeto: ${projectName}`, 14, yPos);
    yPos += 5;
  }
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, yPos);

  // Summary cards
  if (summary) {
    yPos += 8;
    const cardW = 60;
    const cardX = [14, 80, 146];
    const labels = ['Total de Receitas', 'Total de Despesas', 'Saldo'];
    const values = [summary.totalIncome, summary.totalExpenses, summary.balance];
    const colors: [number, number, number][] = [[16, 185, 129], [239, 68, 68], summary.balance >= 0 ? [16, 185, 129] : [239, 68, 68]];

    cardX.forEach((x, i) => {
      doc.setFillColor(...colors[i]);
      doc.roundedRect(x, yPos, cardW, 18, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text(labels[i], x + cardW / 2, yPos + 6, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(values[i]), x + cardW / 2, yPos + 13, { align: 'center' });
      doc.setFont('helvetica', 'normal');
    });
    yPos += 25;
  }

  // Table
  autoTable(doc, {
    startY: yPos,
    head: [['Data', 'Tipo', 'Projeto', 'Categoria', 'Descrição', 'Fornecedor', 'Valor']],
    body: transactions.map((t) => [
      formatDate(t.date),
      t.type === 'income' ? 'Receita' : 'Despesa',
      t.project_name || '',
      t.category_name || '',
      t.description.slice(0, 40),
      (t.vendor || '').slice(0, 25),
      formatCurrency(t.amount),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 18 },
      2: { cellWidth: 45 },
      3: { cellWidth: 30 },
      4: { cellWidth: 65 },
      5: { cellWidth: 40 },
      6: { cellWidth: 25, halign: 'right' },
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const isIncome = transactions[data.row.index]?.type === 'income';
        doc.setTextColor(isIncome ? 16 : 239, isIncome ? 185 : 68, isIncome ? 129 : 68);
      }
    },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i} de ${pageCount}`, 283, 200, { align: 'right' });
    doc.text('FluxoCaixa © ' + new Date().getFullYear(), 14, 200);
  }

  doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
}

export function exportBudgetComparisonToExcel(data: any[], filename: string = 'comparativo_orcamento') {
  const wb = XLSX.utils.book_new();

  data.forEach((project) => {
    const rows = project.categories.map((c: any) => ({
      'Categoria': c.name,
      'Orçado (R$)': c.budget,
      'Realizado (R$)': c.actual_expense,
      'Diferença (R$)': c.budget - c.actual_expense,
      'Utilização (%)': c.budget > 0 ? ((c.actual_expense / c.budget) * 100).toFixed(1) + '%' : 'N/A',
    }));

    // Add totals row
    rows.push({
      'Categoria': 'TOTAL',
      'Orçado (R$)': project.totalBudget,
      'Realizado (R$)': project.totalActual,
      'Diferença (R$)': project.totalBudget - project.totalActual,
      'Utilização (%)': project.totalBudget > 0 ? ((project.totalActual / project.totalBudget) * 100).toFixed(1) + '%' : 'N/A',
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 25 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];
    const sheetName = project.name.slice(0, 31).replace(/[\\/:*?[\]]/g, '_');
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  XLSX.writeFile(wb, `${filename}.xlsx`);
}
