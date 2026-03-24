import ExcelJS from 'exceljs';
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

async function downloadExcel(wb: ExcelJS.Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportToExcel(
  transactions: Transaction[],
  filename: string = 'relatorio',
  summary?: { totalIncome: number; totalExpenses: number; balance: number }
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Lançamentos');

  ws.columns = [
    { header: 'Data', key: 'data', width: 12 },
    { header: 'Tipo', key: 'tipo', width: 10 },
    { header: 'Projeto', key: 'projeto', width: 25 },
    { header: 'Categoria', key: 'categoria', width: 22 },
    { header: 'Descrição', key: 'descricao', width: 35 },
    { header: 'Fornecedor/Cliente', key: 'fornecedor', width: 25 },
    { header: 'Nº Documento', key: 'documento', width: 15 },
    { header: 'Forma Pagamento', key: 'pagamento', width: 18 },
    { header: 'Valor (R$)', key: 'valor', width: 15 },
    { header: 'Observações', key: 'observacoes', width: 30 },
  ];

  transactions.forEach((t) => {
    ws.addRow({
      data: formatDate(t.date),
      tipo: t.type === 'income' ? 'Receita' : 'Despesa',
      projeto: t.project_name || '',
      categoria: t.category_name || '',
      descricao: t.description,
      fornecedor: t.vendor || '',
      documento: t.document_number || '',
      pagamento: t.payment_method || '',
      valor: t.amount,
      observacoes: t.notes || '',
    });
  });

  if (summary) {
    const wsSummary = wb.addWorksheet('Resumo');
    wsSummary.columns = [
      { header: 'Indicador', key: 'indicador', width: 25 },
      { header: 'Valor (R$)', key: 'valor', width: 18 },
    ];
    wsSummary.addRows([
      { indicador: 'Total de Receitas', valor: summary.totalIncome },
      { indicador: 'Total de Despesas', valor: summary.totalExpenses },
      { indicador: 'Saldo', valor: summary.balance },
    ]);
  }

  await downloadExcel(wb, filename);
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

export async function exportBudgetComparisonToExcel(data: any[], filename: string = 'comparativo_orcamento') {
  const wb = new ExcelJS.Workbook();

  data.forEach((project) => {
    const rows = project.categories.map((c: any) => ({
      categoria: c.name,
      orcado: c.budget,
      realizado: c.actual_expense,
      diferenca: c.budget - c.actual_expense,
      utilizacao: c.budget > 0 ? ((c.actual_expense / c.budget) * 100).toFixed(1) + '%' : 'N/A',
    }));

    rows.push({
      categoria: 'TOTAL',
      orcado: project.totalBudget,
      realizado: project.totalActual,
      diferenca: project.totalBudget - project.totalActual,
      utilizacao: project.totalBudget > 0 ? ((project.totalActual / project.totalBudget) * 100).toFixed(1) + '%' : 'N/A',
    });

    const sheetName = project.name.slice(0, 31).replace(/[\\/:*?[\]]/g, '_');
    const ws = wb.addWorksheet(sheetName);
    ws.columns = [
      { header: 'Categoria', key: 'categoria', width: 25 },
      { header: 'Orçado (R$)', key: 'orcado', width: 16 },
      { header: 'Realizado (R$)', key: 'realizado', width: 16 },
      { header: 'Diferença (R$)', key: 'diferenca', width: 16 },
      { header: 'Utilização (%)', key: 'utilizacao', width: 14 },
    ];
    ws.addRows(rows);
  });

  await downloadExcel(wb, filename);
}
