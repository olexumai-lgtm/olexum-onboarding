import { motion } from "framer-motion";
import { Check } from "lucide-react";

export default function Setup() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center font-sans selection:bg-primary/30">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full mx-4 bg-[#111] border border-white/10 rounded-2xl p-12 text-center shadow-2xl"
      >
        <div className="w-24 h-24 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-8 glow-green">
          <Check className="w-12 h-12 text-green-500" />
        </div>

        <h1 className="text-4xl font-bold mb-4 tracking-tight">You're All Set</h1>
        <p className="text-xl text-muted-foreground mb-4">
          Your MedFlow System setup begins now.
        </p>
        <p className="text-lg text-muted-foreground">
          We'll be in touch within 48 hours to get everything configured and running.
        </p>

        <div className="mt-8 flex items-center justify-center gap-2 text-green-500 font-mono text-sm">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          ONBOARDING COMPLETE
        </div>
      </motion.div>
    </div>
  );
}
