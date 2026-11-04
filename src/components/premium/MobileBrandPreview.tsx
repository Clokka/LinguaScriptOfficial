import { Link } from "react-router-dom";
import { Flame, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/premium";
import { ChameleonMascot, type ChameleonTier } from "@/components/ChameleonMascot";

export function ChameleonStates() {
  return <div className="ls-chameleon-states">{([['red','New'],['orange','Learning'],['green','Known']] as [ChameleonTier,string][]).map(([tier,label]) => <div key={tier}><ChameleonMascot tier={tier} className="ls-state-mascot" /><p className={`font-semibold ls-state-${tier}`}>{label}</p></div>)}</div>;
}

export function HabitsPreview() {
  return <div className="space-y-6"><p className="text-xs text-warning">ILLUSTRATIVE DATA · NOT YOUR ACCOUNT</p><GlassCard className="p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Today's words</h2><p className="text-3xl font-bold">6<span className="text-base text-muted-foreground"> / 8</span></p></div><div className="ls-goal-track mt-5"><span /></div></GlassCard><div className="grid grid-cols-2 gap-4"><GlassCard className="p-5"><Flame className="mb-3 h-6 w-6 text-accent" /><p className="text-3xl font-bold">12</p><p className="text-sm text-muted-foreground">day streak</p></GlassCard><GlassCard className="p-5"><p className="mt-9 text-3xl font-bold">Level 7</p><p className="text-sm text-muted-foreground">learning progress</p></GlassCard></div><section className="border-t border-border pt-6"><h2 className="font-semibold">Friends this week · sample</h2>{[["Maya","1,240"],["You","1,105"],["Leo","890"]].map(([name,xp],i) => <div className="flex items-center gap-4 border-b border-border py-5" key={name}><span className="text-muted-foreground">{i+1}</span><span className="font-semibold">{name}</span><span className="ml-auto font-semibold text-primary">{xp} XP</span></div>)}</section><div className="flex flex-wrap gap-3"><Button asChild><Link to="/friends">Open your friends<ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button variant="outline" asChild><Link to="/profile">Set your daily word goal</Link></Button></div></div>;
}