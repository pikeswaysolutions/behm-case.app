import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const PDF_CONFIG = {
  pageWidth: 210,
  pageHeight: 297,
  margin: 15,
  headerHeight: 25,
  footerHeight: 10
};

async function captureElement(element, options = {}) {
  if (!element) return null;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    ...options
  });

  return canvas;
}

function addHeader(pdf, title, filters, pageNum, totalPages) {
  const { pageWidth, margin } = PDF_CONFIG;

  pdf.setFillColor(27, 42, 65);
  pdf.rect(0, 0, pageWidth, 20, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, margin, 13);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 20, 13);

  pdf.setTextColor(100, 100, 100);
  pdf.setFontSize(8);
  let filterText = `Date Range: ${filters.startDate} to ${filters.endDate}`;
  if (filters.grouping) filterText += ` | Grouped: ${filters.grouping}`;
  if (filters.director && filters.director !== 'all') filterText += ` | Director: ${filters.directorName || filters.director}`;
  pdf.text(filterText, margin, 28);
}

function addFooter(pdf, pageNum) {
  const { pageWidth, pageHeight, margin } = PDF_CONFIG;

  pdf.setTextColor(150, 150, 150);
  pdf.setFontSize(8);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, pageHeight - 8);
  pdf.text('Behm Funeral Home', pageWidth - margin - 30, pageHeight - 8);
}

async function addCanvasToPage(pdf, canvas, y, maxHeight) {
  const { pageWidth, margin } = PDF_CONFIG;
  const contentWidth = pageWidth - (margin * 2);

  const imgWidth = contentWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const finalHeight = Math.min(imgHeight, maxHeight);
  const finalWidth = (finalHeight / imgHeight) * imgWidth;

  const imgData = canvas.toDataURL('image/png');
  pdf.addImage(imgData, 'PNG', margin, y, finalWidth, finalHeight);

  return finalHeight;
}

export async function exportDashboardToPDF(options) {
  const {
    title = 'Dashboard Report',
    filters,
    metricsContainer,
    chartsContainer,
    tableContainer,
    onProgress
  } = options;

  const pdf = new jsPDF('p', 'mm', 'a4');
  const { pageWidth, pageHeight, margin, headerHeight, footerHeight } = PDF_CONFIG;
  const contentWidth = pageWidth - (margin * 2);
  const maxContentHeight = pageHeight - headerHeight - footerHeight - 10;

  let currentPage = 1;
  let totalPages = 1;
  let yPosition = headerHeight + 15;

  onProgress?.('Capturing metrics...');

  if (metricsContainer) {
    const metricsCanvas = await captureElement(metricsContainer);
    if (metricsCanvas) {
      const height = await addCanvasToPage(pdf, metricsCanvas, yPosition, 60);
      yPosition += height + 10;
    }
  }

  onProgress?.('Capturing charts...');

  if (chartsContainer) {
    const chartsCanvas = await captureElement(chartsContainer);
    if (chartsCanvas) {
      const imgHeight = (chartsCanvas.height * contentWidth) / chartsCanvas.width;

      if (yPosition + imgHeight > maxContentHeight + headerHeight) {
        addHeader(pdf, title, filters, currentPage, totalPages);
        addFooter(pdf, currentPage);
        pdf.addPage();
        currentPage++;
        yPosition = headerHeight + 15;
      }

      const height = await addCanvasToPage(pdf, chartsCanvas, yPosition, maxContentHeight - 20);
      yPosition += height + 10;
    }
  }

  onProgress?.('Capturing table...');

  if (tableContainer) {
    const tableCanvas = await captureElement(tableContainer);
    if (tableCanvas) {
      const imgHeight = (tableCanvas.height * contentWidth) / tableCanvas.width;

      if (yPosition + Math.min(imgHeight, 100) > maxContentHeight + headerHeight) {
        addHeader(pdf, title, filters, currentPage, totalPages);
        addFooter(pdf, currentPage);
        pdf.addPage();
        currentPage++;
        yPosition = headerHeight + 15;
      }

      const height = await addCanvasToPage(pdf, tableCanvas, yPosition, maxContentHeight - yPosition + headerHeight);
      yPosition += height + 10;
    }
  }

  totalPages = currentPage;

  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    addHeader(pdf, title, filters, i, totalPages);
    addFooter(pdf, i);
  }

  onProgress?.('Generating PDF...');

  return pdf;
}

export async function exportReportsToPDF(options) {
  const {
    title = 'Reports',
    filters,
    metricsContainer,
    chartsContainer,
    tableContainer,
    onProgress
  } = options;

  return exportDashboardToPDF({
    title,
    filters,
    metricsContainer,
    chartsContainer,
    tableContainer,
    onProgress
  });
}

export function downloadPDF(pdf, filename) {
  pdf.save(filename);
}
