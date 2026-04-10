import { motion } from "framer-motion";
import { Check, MessageSquare, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ThankYou() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4 font-sans selection:bg-primary/30 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-green-500/10 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full bg-[#111] border border-white/10 rounded-2xl p-12 text-center relative z-10 shadow-2xl"
      >
        <div className="w-24 h-24 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-8 glow-green">
          <Check className="w-12 h-12 text-green-500" />
        </div>

        <h1 className="text-4xl font-bold mb-4 tracking-tight">You're All Set</h1>
        <p className="text-xl text-muted-foreground mb-12">
          Your MedFlow System setup begins now. We'll be in touch within 48 hours.
        </p>

        <div className="grid gap-6 text-left mb-12">
          <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 mt-1">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white mb-1">Set Up Call Forwarding</h3>
              <p className="text-sm text-muted-foreground">
                Check your email for call forwarding instructions — your agent can't take calls until this is done. It only takes a couple minutes.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="p-2 bg-green-500/20 rounded-lg text-green-400 mt-1">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white mb-1">Then Sit Back — We Handle the Rest</h3>
              <p className="text-sm text-muted-foreground">
                Once forwarding is confirmed, your agent goes live within 48 hours.
              </p>
            </div>
          </div>
        </div>

        <Button 
          variant="outline" 
          className="border-white/10 hover:bg-white/5 text-white"
          onClick={() => window.location.href = "https://olexum.solutions"}
        >
          Return to Homepage <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </motion.div>
      
      <div className="mt-8 text-xs text-muted-foreground font-mono">
        SESSION ID: {Math.random().toString(36).substring(7).toUpperCase()} • SECURE
      </div>
    </div>
  );
}
