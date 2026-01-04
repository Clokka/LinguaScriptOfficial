import { useState } from "react";
import {
  Languages,
  Subtitles,
  Volume2,
  Flame,
  BookOpen,
  Star,
  Settings,
  ChevronRight,
} from "lucide-react";
import { Switch } from "./ui/switch";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { StreakBadge } from "./StreakBadge";
import { XPProgress } from "./XPProgress";

interface SettingsPanelProps {
  className?: string;
}

export const SettingsPanel = ({ className }: SettingsPanelProps) => {
  const [subtitleMode, setSubtitleMode] = useState<"single" | "dual">("dual");
  const [soundEffects, setSoundEffects] = useState(true);
  const [streakVisible, setStreakVisible] = useState(true);
  const [flashcardReminders, setFlashcardReminders] = useState(true);

  const stats = {
    streak: 7,
    level: 12,
    currentXP: 2340,
    levelXP: 3000,
    wordsLearned: 847,
  };

  return (
    <div className={cn("glass-panel-strong p-6 w-80", className)}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
          <Settings className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-bold text-foreground">Ligua Settings</h2>
          <p className="text-xs text-muted-foreground">Customize your experience</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="space-y-3 mb-6">
        <StreakBadge streak={stats.streak} className="w-full justify-center" />
        <XPProgress
          level={stats.level}
          currentXP={stats.currentXP}
          levelXP={stats.levelXP}
        />
        <div className="glass-panel p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-success" />
            <span className="text-sm text-muted-foreground">Words learned</span>
          </div>
          <span className="font-bold text-foreground">{stats.wordsLearned}</span>
        </div>
      </div>

      {/* Settings */}
      <div className="space-y-1">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Display Settings
        </h3>

        <SettingRow
          icon={<Languages className="w-4 h-4" />}
          label="Learning Language"
          action={
            <Button variant="ghost" size="sm" className="h-8 text-primary">
              Spanish <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          }
        />

        <SettingRow
          icon={<Subtitles className="w-4 h-4" />}
          label="Subtitle Mode"
          action={
            <div className="flex gap-1">
              <Button
                variant={subtitleMode === "single" ? "default" : "ghost"}
                size="sm"
                className="h-8"
                onClick={() => setSubtitleMode("single")}
              >
                Single
              </Button>
              <Button
                variant={subtitleMode === "dual" ? "default" : "ghost"}
                size="sm"
                className="h-8"
                onClick={() => setSubtitleMode("dual")}
              >
                Dual
              </Button>
            </div>
          }
        />

        <SettingRow
          icon={<Volume2 className="w-4 h-4" />}
          label="Sound Effects"
          action={
            <Switch checked={soundEffects} onCheckedChange={setSoundEffects} />
          }
        />

        <SettingRow
          icon={<Flame className="w-4 h-4" />}
          label="Show Streak"
          action={
            <Switch checked={streakVisible} onCheckedChange={setStreakVisible} />
          }
        />

        <SettingRow
          icon={<BookOpen className="w-4 h-4" />}
          label="Daily Reminders"
          action={
            <Switch
              checked={flashcardReminders}
              onCheckedChange={setFlashcardReminders}
            />
          }
        />

        <SettingRow
          icon={<Star className="w-4 h-4" />}
          label="Difficulty Filter"
          action={
            <Button variant="ghost" size="sm" className="h-8 text-primary">
              1-3 ⭐ <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          }
        />
      </div>
    </div>
  );
};

const SettingRow = ({
  icon,
  label,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  action: React.ReactNode;
}) => (
  <div className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-muted/50 transition-colors">
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm text-foreground">{label}</span>
    </div>
    {action}
  </div>
);
