const PDFDocument = require('pdfkit');

const money = (cents) =>
  '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const BRAND = '#0f3d3e';
const GREY = '#6b7280';


exports.buildInvoicePdf = (invoice, client) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const isPaid = invoice.status === 'Paid';


    doc.roundedRect(50, 45, 40, 40, 8).fill(BRAND);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(24).text('N', 50, 54, { width: 40, align: 'center' });
    doc.fillColor(BRAND).fontSize(18).text('Nexus Corporate Services', 100, 50);
    doc.fillColor(GREY).font('Helvetica').fontSize(9).text('New York, NY, USA', 100, 72);

    doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(22).text(isPaid ? 'RECEIPT' : 'INVOICE', 350, 50, {
      width: 195,
      align: 'right',
    });
    doc.fillColor(GREY).font('Helvetica').fontSize(10).text(invoice.invoiceNumber, 350, 78, {
      width: 195,
      align: 'right',
    });

    doc.moveTo(50, 110).lineTo(545, 110).strokeColor('#e5e7eb').stroke();


    doc.fillColor(GREY).fontSize(9).text('BILLED TO', 50, 130);
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(12).text(client.name, 50, 145);
    doc.font('Helvetica').fontSize(10).fillColor('#374151');
    if (client.company) doc.text(client.company, 50, 162);
    doc.text(client.email, 50, client.company ? 177 : 162);

    doc.fillColor(GREY).fontSize(9).text('ISSUED', 350, 130, { width: 195, align: 'right' });
    doc.fillColor('#111827').fontSize(10).text(fmtDate(invoice.createdAt), 350, 143, { width: 195, align: 'right' });
    doc.fillColor(GREY).fontSize(9).text('DUE DATE', 350, 163, { width: 195, align: 'right' });
    doc.fillColor('#111827').fontSize(10).text(fmtDate(invoice.dueDate), 350, 176, { width: 195, align: 'right' });
    if (isPaid) {
      doc.fillColor(GREY).fontSize(9).text('PAID ON', 350, 196, { width: 195, align: 'right' });
      doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(10).text(fmtDate(invoice.paidAt), 350, 209, {
        width: 195,
        align: 'right',
      });
    }


    let y = 250;
    doc.rect(50, y, 495, 24).fill(BRAND);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
    doc.text('Description', 60, y + 7);
    doc.text('Amount', 445, y + 7, { width: 90, align: 'right' });
    y += 24;

    doc.font('Helvetica').fillColor('#111827');
    invoice.items.forEach((item, i) => {
      if (i % 2 === 0) doc.rect(50, y, 495, 26).fill('#f9fafb');
      doc.fillColor('#111827').fontSize(10);
      doc.text(item.description, 60, y + 8, { width: 370 });
      doc.text(money(item.amountCents), 445, y + 8, { width: 90, align: 'right' });
      y += 26;
    });

    doc.moveTo(50, y + 4).lineTo(545, y + 4).strokeColor('#e5e7eb').stroke();
    doc.font('Helvetica-Bold').fontSize(13).fillColor(BRAND);
    doc.text('Total', 350, y + 16, { width: 90, align: 'right' });
    doc.text(money(invoice.amountCents), 445, y + 16, { width: 90, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor(GREY).text(
      `Currency: ${invoice.currency.toUpperCase()}`,
      350,
      y + 36,
      { width: 185, align: 'right' }
    );


    if (isPaid) {
      doc.save();
      doc.rotate(-18, { origin: [300, y + 140] });
      doc.opacity(0.85).lineWidth(5).strokeColor('#16a34a').roundedRect(190, y + 100, 220, 80, 10).stroke();
      doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(54).text('PAID', 190, y + 112, {
        width: 220,
        align: 'center',
      });
      doc.restore();
      doc.opacity(1);
      if (invoice.stripePaymentIntentId) {
        doc.font('Helvetica').fontSize(8).fillColor(GREY).text(
          `Payment reference: ${invoice.stripePaymentIntentId}`,
          50,
          y + 200
        );
      }
    }


    doc.font('Helvetica').fontSize(9).fillColor(GREY).text(
      'Thank you for your business. Questions? Contact billing@nexuscorporate.example',
      50,
      770,
      { width: 495, align: 'center' }
    );

    doc.end();
  });