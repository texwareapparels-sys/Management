/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Robust print helper:
 * 1. Checks if iframe or restricted environment prevents window.print()
 * 2. If standard window.print() can run, runs it smoothly
 * 3. Also provides a dedicated isolated print window/iframe popup that extracts the targeted HTML
 *    and prints it directly, ensuring thermal 58mm or standard A4 prints work everywhere!
 */

import { isTelegramWebApp, openInExternalBrowser } from './telegram';

export interface PrintResult {
  success: boolean;
  isTelegram: boolean;
  message?: string;
}

export function printElement(
  element: HTMLElement | null,
  title: string = 'TexWare Payslip',
  type: 'pos' | 'sheet' | 'landscape' | 'contract' | 'auto' = 'auto'
): PrintResult {
  const isTg = isTelegramWebApp();

  if (!element) {
    try {
      window.print();
      return { success: true, isTelegram: isTg };
    } catch (e) {
      return { success: false, isTelegram: isTg };
    }
  }

  const isPos = type === 'pos' || (type === 'auto' && element.id === 'invoicePrintArea');
  const isLandscape =
    type === 'landscape' ||
    element.classList.contains('print-landscape') ||
    element.id.toLowerCase().includes('landscape') ||
    element.id.toLowerCase().includes('master');
  const isContract =
    type === 'contract' ||
    element.id.toLowerCase().includes('contract') ||
    element.id.toLowerCase().includes('resignation') ||
    element.id.toLowerCase().includes('suspension') ||
    element.id.toLowerCase().includes('termination') ||
    element.id.toLowerCase().includes('application') ||
    element.id.toLowerCase().includes('rejection') ||
    element.id.toLowerCase().includes('notice');

  // Collect host document styles (Tailwind, fonts, custom styles)
  const hostStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((el) => el.outerHTML)
    .join('\n');

  const pageStyle = isPos
    ? `@page { size: 58mm auto; margin: 0; }
       .print-container { width: 58mm; max-width: 58mm; margin: 0 auto; padding: 4px; }`
    : isLandscape
    ? `@page { size: A4 landscape; margin: 5mm; }
       .print-container { width: 100%; max-width: 100%; margin: 0 auto; padding: 4px; }`
    : isContract
    ? `@page { size: A4 portrait; margin: 3mm 4mm; }
       html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; width: 100% !important; }
       .print-container { width: 100% !important; max-width: 790px !important; margin: 0 auto !important; padding: 0 !important; }
       #workerContractLetterA4Area, #printableA4InvestmentAgreement, #workerResignationLetterA4Area, #workerSuspensionNoticeA4Area, #workerTerminationNoticeA4Area, #workerMonthlyAttendancePrintArea, #jobApplicationPrintArea, #blankJobApplicationPrintArea, #rejectionLetterPrintArea { border: none !important; box-shadow: none !important; width: 100% !important; padding: 1mm 2mm !important; page-break-inside: avoid !important; page-break-after: avoid !important; }`
    : `@page { size: A4 portrait; margin: 5mm; }
       .print-container { width: 100%; max-width: 100%; margin: 0 auto; padding: 4px; }
       #workerMonthlyAttendancePrintArea { border: none !important; box-shadow: none !important; width: 100% !important; padding: 2mm !important; }`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="bn">
      <head>
        <title>${title}</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        ${hostStyles}
        <style>
          ${pageStyle}
          *, *::before, *::after {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            font-family: "Noto Sans Bengali", "Kalpurush", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            color: #0f172a !important;
            font-size: 11px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            padding: 2.5px 4.5px !important;
            border: 1px solid #94a3b8 !important;
            font-size: 10px;
          }
          th {
            background-color: #f1f5f9 !important;
            font-weight: 700;
          }
          button, .no-print, select.no-print, input.no-print {
            display: none !important;
          }
          .hidden.print\\:block,
          .hidden.print-block,
          .print\\:block,
          .print-block {
            display: block !important;
          }
          .hidden.print\\:inline-block,
          .print\\:inline-block {
            display: inline-block !important;
          }
          .hidden.print\\:flex,
          .print\\:flex {
            display: flex !important;
          }
          .flex { display: flex !important; }
          .flex-col { flex-direction: column !important; }
          .flex-1 { flex: 1 1 0% !important; }
          .items-center { align-items: center !important; }
          .items-start { align-items: flex-start !important; }
          .items-end { align-items: flex-end !important; }
          .justify-between { justify-content: space-between !important; }
          .justify-center { justify-content: center !important; }
          .justify-end { justify-content: flex-end !important; }
          .grid { display: grid !important; }
          .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
          .shrink-0 { flex-shrink: 0 !important; }
          .text-center { text-align: center !important; }
          .text-right { text-align: right !important; }
          .text-left { text-align: left !important; }
          .font-bold { font-weight: 700 !important; }
          .font-black { font-weight: 900 !important; }
          .w-full { width: 100% !important; }
          .border-b { border-bottom-width: 1px !important; }
          .border-b-2 { border-bottom-width: 2px !important; }
          .border-t-2 { border-top-width: 2px !important; }
        </style>
      </head>
      <body>
        <div class="print-container">
          ${element.innerHTML}
        </div>
      </body>
    </html>
  `;

  // 1. Reliable Iframe Print: positioned off-screen with full dimension (never visibility: hidden or 0x0)
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = isLandscape ? '1120px' : '820px';
    iframe.style.height = '1000px';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.zIndex = '-9999';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn("Iframe print error:", e);
        }
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 5000);
      }, 300);

      return { success: true, isTelegram: isTg };
    }
  } catch (e) {
    console.warn("Iframe print attempt failed, trying fallback:", e);
  }

  // 2. Fallback: isolated popup window (if iframe wasn't supported)
  try {
    const printWindow = window.open('', '_blank', 'width=900,height=900');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch (e) {}
      }, 350);
      return { success: true, isTelegram: isTg };
    }
  } catch (err) {
    console.warn("Pop-up window blocked or restricted:", err);
  }

  // 3. Fallback to standard window.print()
  try {
    window.print();
  } catch (e) {}

  return { success: !isTg, isTelegram: isTg };
}

/**
 * Downloads an HTML element directly as a high-resolution A4 PDF document.
 * Automatically fits single-page documents (forms, contracts, letters) cleanly within 1 A4 page (210mm x 297mm)
 * with precise margins and sharp resolution, without spilling onto an accidental 2nd page.
 */
export async function exportElementToPdf(
  element: HTMLElement | null,
  filename: string = 'document.pdf',
  onProgress?: (status: boolean) => void,
  forceSinglePage: boolean = true
): Promise<boolean> {
  if (!element) return false;
  try {
    onProgress?.(true);
    const html2canvas = (await import('html2canvas-pro')).default;
    const { jsPDF } = await import('jspdf');

    // Create high-res canvas with full oklch & modern CSS support
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth || 794,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const a4Width = 210;
    const a4Height = 297;

    const canvasAspect = canvas.height / canvas.width; // standard A4 aspect is 297/210 = 1.414

    // Single-page A4 fitting (if forceSinglePage is true or aspect ratio is close to A4 <= 1.7)
    if (forceSinglePage || canvasAspect <= 1.7) {
      const margin = 4; // 4mm printable margin
      const maxWidth = a4Width - (margin * 2); // 202mm
      const maxHeight = a4Height - (margin * 2); // 289mm

      const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
      const renderWidth = canvas.width * scale;
      const renderHeight = canvas.height * scale;

      const posX = (a4Width - renderWidth) / 2;
      const posY = (a4Height - renderHeight) / 2;

      pdf.addImage(imgData, 'JPEG', posX, posY, renderWidth, renderHeight, undefined, 'FAST');
    } else {
      // Multi-page document splitting for very long pages
      const imgWidth = a4Width;
      const imgHeight = (canvas.height * a4Width) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= a4Height;

      while (heightLeft > 5) {
        position -= a4Height;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= a4Height;
      }
    }

    const cleanName = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(cleanName);
    onProgress?.(false);
    return true;
  } catch (error) {
    console.error('PDF export failed, using print fallback:', error);
    onProgress?.(false);
    // Fallback: trigger print
    printElement(element, filename, 'contract');
    return false;
  }
}

