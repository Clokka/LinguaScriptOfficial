// Shown on the Watch page ONLY when this video is a task a teacher set for a
// class the learner is in. It says exactly what the teacher can see, so the
// learner is never tracked without knowing. Every other video stays private.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function AssignedVideoNotice({ filmId }: { filmId: string }) {
  const { user } = useAuth();
  const [schools, setSchools] = useState<string[]>([]);

  useEffect(() => {
    if (!user || !filmId) { setSchools([]); return; }
    let alive = true;
    supabase.rpc("my_class_tasks").then(({ data }) => {
      if (!alive) return;
      const names = (data || []).filter((t) => t.film_id === filmId).map((t) => t.school_name);
      setSchools([...new Set(names)]);
    });
    return () => { alive = false; };
  }, [user, filmId]);

  if (schools.length === 0) return null;
  return (
    <div role="note" className="flex items-start gap-2 px-4 py-2 bg-primary/15 text-xs text-white/90 border-b border-primary/30">
      <GraduationCap className="w-4 h-4 shrink-0 text-primary mt-0.5" />
      <p>
        <b>This video is a task from {schools.join(", ")}.</b> Your teacher can see how far you watch it,
        how many times, and how green it gets — for this video only. Nothing else you watch is shared.{" "}
        <Link to="/classes" className="underline">What your teacher sees</Link>
      </p>
    </div>
  );
}
