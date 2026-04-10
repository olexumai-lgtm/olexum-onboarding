import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, FileText } from "lucide-react";
import { Link } from "wouter";

export default function Legal() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-primary/30">
      {/* Header / Nav */}
      <div className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5 px-4 py-4 md:px-8">
        <div className="max-w-4xl mx-auto flex items-center">
          <Link href="/">
            <Button variant="ghost" className="text-muted-foreground hover:text-white hover:bg-white/5 -ml-2 md:ml-0">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Onboarding
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 md:px-8">
        <div className="mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Legal Documents
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Please review our standard terms and liability policies carefully.
          </p>
        </div>
        
        <div className="grid gap-8 md:gap-12">
          {/* Terms of Service */}
          <section className="bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <FileText className="w-32 h-32" />
            </div>
            
            <div className="relative z-10">
              <h2 className="text-xl md:text-2xl font-semibold text-blue-400 mb-6 flex items-center gap-3">
                <FileText className="w-6 h-6" /> Terms of Service
              </h2>
              
              <div className="space-y-6 text-sm md:text-base text-muted-foreground leading-relaxed">
                <div className="p-4 bg-white/5 rounded-lg border border-white/5">
                  <strong className="text-white block mb-1">1. Service Description</strong>
                  Olexum provides AI-powered voice automation services ("Agents") designed to handle inbound and outbound calls for business purposes.
                </div>

                <div className="p-4 bg-white/5 rounded-lg border border-white/5">
                  <strong className="text-white block mb-1">2. Accuracy Disclaimer</strong>
                  Client acknowledges that AI technology is experimental and may occasionally produce inaccurate, incomplete, or unexpected results. Olexum is not responsible for the content of AI-generated conversations.
                </div>

                <div className="p-4 bg-white/5 rounded-lg border border-white/5">
                  <strong className="text-white block mb-1">3. Usage Limits</strong>
                  Services are subject to fair usage policies. Excessive usage beyond agreed limits may incur additional charges.
                </div>

                <div className="p-4 bg-white/5 rounded-lg border border-white/5">
                  <strong className="text-white block mb-1">4. Cancellation</strong>
                  Clients may cancel their service at any time by providing written notice. Any outstanding invoices for appointments already completed remain due.
                </div>
              </div>
            </div>
          </section>

          {/* Liability Waiver */}
          <section className="bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Shield className="w-32 h-32" />
            </div>

            <div className="relative z-10">
              <h2 className="text-xl md:text-2xl font-semibold text-green-400 mb-6 flex items-center gap-3">
                <Shield className="w-6 h-6" /> Liability Waiver
              </h2>
              
              <div className="space-y-6 text-sm md:text-base text-muted-foreground leading-relaxed">
                <div className="p-4 bg-white/5 rounded-lg border border-white/5">
                  <strong className="text-white block mb-1">1. Limitation of Liability</strong>
                  To the maximum extent permitted by law, Olexum shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, use, goodwill, or other intangible losses.
                </div>

                <div className="p-4 bg-white/5 rounded-lg border border-white/5">
                  <strong className="text-white block mb-1">2. Third-Party Services</strong>
                  Olexum integrates with third-party services (e.g., OpenAI, Twilio, Stripe). We are not responsible for outages, data breaches, or failures caused by these third-party providers.
                </div>

                <div className="p-4 bg-white/5 rounded-lg border border-white/5">
                  <strong className="text-white block mb-1">3. Compliance</strong>
                  Client is solely responsible for ensuring their use of the AI Agent complies with all applicable laws, including TCPA, GDPR, and call recording regulations.
                </div>
              </div>
            </div>
          </section>
        </div>
        
        <div className="mt-12 pt-8 border-t border-white/10 text-center text-xs md:text-sm text-muted-foreground font-mono">
          <p>&copy; {new Date().getFullYear()} Olexum Group LLC. All rights reserved.</p>
          <p className="mt-2 opacity-50">Last Updated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}
