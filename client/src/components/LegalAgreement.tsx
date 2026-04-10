import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { jsPDF } from "jspdf";

interface LegalAgreementProps {
  companyName: string;
  contactName: string;
  contactEmail: string;
  onSign: (signatureData: {
    signedName: string;
    signedTitle: string;
    signedDate: string;
    signedEmail: string;
  }) => void;
}

export const LegalAgreement: React.FC<LegalAgreementProps> = ({
  companyName,
  contactName,
  contactEmail,
  onSign
}) => {
  const [signedName, setSignedName] = useState('');
  const [signedTitle, setSignedTitle] = useState('');
  const [signedEmail, setSignedEmail] = useState(contactEmail || '');
  const [todayDate, setTodayDate] = useState('');

  useEffect(() => {
    const date = new Date();
    const formattedDate = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    setTodayDate(formattedDate);
  }, []);

  useEffect(() => {
    onSign({
      signedName,
      signedTitle,
      signedDate: todayDate,
      signedEmail
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedName, signedTitle, signedEmail, todayDate]);

  const generatePDF = () => {
    const doc = new jsPDF();
    const lineHeight = 7;
    let y = 20;
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;
    const contentWidth = pageWidth - (margin * 2);

    // Helper for text wrapping
    const addWrappedText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      const lines = doc.splitTextToSize(text, contentWidth);
      doc.text(lines, margin, y);
      y += (lines.length * lineHeight);
    };

    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("OLEXUM SERVICES AGREEMENT", pageWidth / 2, y, { align: "center" });
    y += 15;

    // Parties
    addWrappedText(`Effective Date: ${todayDate}`);
    addWrappedText(`Between: Olexum LLC ("Olexum")`);
    addWrappedText(`And: ${companyName || "[Client Company Name]"} ("Client")`);
    y += 5;

    // Sections
    const sections = [
      {
        title: "1. SERVICES PROVIDED",
        content: "Olexum agrees to deliver AI Voice Agent setup, including automated call routing, dashboard access, and basic prompt configuration. Services will be provisioned within 48 hours of contract signing."
      },
      {
        title: "2. PRICING & PAYMENT TERMS",
        content: "Services are billed on a pay-per-appointment basis. There is no upfront cost and no recurring subscription fee. Client will be invoiced bi-weekly for completed appointments handled by the AI Voice Agent. Payment is due upon receipt of each invoice."
      },
      {
        title: "3. CANCELLATION POLICY",
        content: "This Agreement is ongoing with no minimum commitment. Client retains full autonomy to cancel services at any time by providing written notice. Any outstanding invoices for appointments already completed remain due."
      },
      {
        title: "4. LIMITATION OF LIABILITY",
        content: "To the maximum extent permitted by law, Olexum's total liability shall not exceed the total fees paid by the Client in the three (3) months preceding any claim. Olexum is not liable for indirect, incidental, or consequential damages, nor does it guarantee specific revenue or lead volume."
      },
      {
        title: "5. CONFIDENTIALITY & DATA",
        content: "Client retains ownership of all business data. Olexum will maintain industry-standard security measures to protect Client information and call logs."
      },
      {
        title: "6. GOVERNING LAW",
        content: "This Agreement shall be governed by and construed in accordance with the laws of the State of Florida."
      }
    ];

    sections.forEach(section => {
      y += 5;
      addWrappedText(section.title, 11, true);
      addWrappedText(section.content, 10, false);
    });

    y += 10;
    
    // Signatures
    addWrappedText("SIGNATURES", 12, true);
    y += 10;

    // Olexum Signature
    addWrappedText("OLEXUM LLC", 10, true);
    doc.setFont("times", "italic");
    doc.text("Olexum Group", margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Authorized Signature", margin, y);
    doc.text(`Date: ${todayDate}`, margin, y + 5);
    
    y += 20;

    // Client Signature
    addWrappedText(`CLIENT: ${companyName || "[Company Name]"}`, 10, true);
    if (signedName) {
      doc.setFont("times", "italic");
      doc.text(signedName, margin, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Title: ${signedTitle || "N/A"}`, margin, y);
      doc.text(`Email: ${signedEmail}`, margin, y + 5);
      doc.text(`Date: ${todayDate}`, margin, y + 10);
    } else {
      doc.text("[Signature Required]", margin, y);
    }

    doc.save("Olexum_Services_Agreement.pdf");
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl text-primary">OLEXUM SERVICES AGREEMENT</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={generatePDF}
            className="gap-2 border-primary/20 hover:bg-primary/10"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
        </CardHeader>
        <CardContent className="prose prose-invert max-w-none space-y-6 text-sm md:text-base">
          
          <div className="space-y-2">
            <p><strong>Effective Date:</strong> <span className="text-primary font-medium">{todayDate}</span></p>
            <p><strong>Between:</strong> Olexum LLC ("Olexum")</p>
            <p><strong>And:</strong> <span className="text-primary font-medium">{companyName || "[Client Company Name]"}</span> ("Client")</p>
          </div>

          <Separator className="my-6" />

          <section>
            <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">1. SERVICES PROVIDED</h3>
            <p>Olexum agrees to deliver AI Voice Agent setup, including automated call routing, dashboard access, and basic prompt configuration. Services will be provisioned within 48 hours of contract signing.</p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">2. PRICING & PAYMENT TERMS</h3>
            <p>Services are billed on a <strong>pay-per-appointment</strong> basis. There is no upfront cost and no recurring subscription fee. Client will be invoiced bi-weekly for completed appointments handled by the AI Voice Agent. Payment is due upon receipt of each invoice.</p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">3. CANCELLATION POLICY</h3>
            <p>This Agreement is ongoing with no minimum commitment. Client retains full autonomy to cancel services at any time by providing written notice. Any outstanding invoices for appointments already completed remain due.</p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">4. LIMITATION OF LIABILITY</h3>
            <p>To the maximum extent permitted by law, Olexum's total liability shall not exceed the total fees paid by the Client in the three (3) months preceding any claim. Olexum is not liable for indirect, incidental, or consequential damages, nor does it guarantee specific revenue or lead volume.</p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">5. CONFIDENTIALITY & DATA</h3>
            <p>Client retains ownership of all business data. Olexum will maintain industry-standard security measures to protect Client information and call logs.</p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">6. GOVERNING LAW</h3>
            <p>This Agreement shall be governed by and construed in accordance with the laws of the State of Florida.</p>
          </section>

          <Separator className="my-8" />

          <div className="bg-muted/30 p-6 rounded-lg border border-border/50 space-y-8">
            <h3 className="text-xl font-semibold text-center mb-6">SIGNATURES</h3>
            
            <div className="grid md:grid-cols-2 gap-8">
              {/* Provider Block */}
              <div className="space-y-4 opacity-70 pointer-events-none">
                <div className="font-semibold text-lg">OLEXUM LLC</div>
                <div className="space-y-2">
                  <Label>Signed By</Label>
                  <div className="font-serif italic text-3xl text-primary">Olexum Group</div>
                  <div className="text-xs text-muted-foreground border-t border-border pt-1">Authorized Signature</div>
                </div>
                <div className="space-y-1">
                  <Label>Date</Label>
                  <div>{todayDate}</div>
                </div>
              </div>

              {/* Client Block */}
              <div className="space-y-4">
                <div className="font-semibold text-lg">CLIENT: <span className="text-primary">{companyName || "[Company Name]"}</span></div>
                
                <div className="space-y-2">
                  <Label htmlFor="signedName" className="text-foreground">Type Full Name to Sign <span className="text-red-500">*</span></Label>
                  <Input 
                    id="signedName"
                    value={signedName}
                    onChange={(e) => setSignedName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="bg-background/50 border-primary/30 focus:border-primary font-medium"
                  />
                  <p className="text-xs text-muted-foreground">By typing your name, you agree to be legally bound by this Agreement.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signedTitle">Title</Label>
                  <Input 
                    id="signedTitle"
                    value={signedTitle}
                    onChange={(e) => setSignedTitle(e.target.value)}
                    placeholder="e.g. CEO, Owner"
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signedEmail">Email for Copy</Label>
                  <Input 
                    id="signedEmail"
                    type="email"
                    value={signedEmail}
                    onChange={(e) => setSignedEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-1 pt-2">
                  <Label>Date</Label>
                  <div className="text-foreground font-medium">{todayDate}</div>
                </div>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
};
