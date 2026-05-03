type StatusBoxProps = {
  verdict: "TRUST" | "VERIFY" | "DO NOT TRUST";
  message?: string;
};

export function StatusBox({ verdict, message }: StatusBoxProps) {
  const isTrusted = verdict === "TRUST";
  const isBlocked = verdict === "DO NOT TRUST";

  const color = isTrusted
    ? "mintx"
    : isBlocked
    ? "red-400"
    : "yellow-400";

  const label = isTrusted
    ? "TRUSTED"
    : isBlocked
    ? "UNTRUSTED"
    : "VERIFY";

  const execution = isTrusted
    ? "Execution: ALLOWED"
    : isBlocked
    ? "Execution: BLOCKED"
    : "Execution: REVIEW";

  return (
    <div
      className={`
        inline-flex flex-col gap-1
        px-4 py-3
        bg-white/[0.02]
        border border-white/10
        rounded-lg
        w-fit max-w-full
        border-l-2
      `}
      style={{
        borderLeftColor: isTrusted
          ? "#34d399" // mint
          : isBlocked
          ? "#f87171" // red
          : "#facc15", // yellow
      }}
    >
      {/* BIG LABEL */}
      <div
        className={`text-lg font-bold tracking-wide ${
          isTrusted
            ? "text-mintx"
            : isBlocked
            ? "text-red-400"
            : "text-yellow-400"
        }`}
      >
        {label}
      </div>

      {/* SUBTEXT */}
      <div className="text-xs text-white/60">
        {message || "Grounded in verified sources"}
      </div>

      {/* EXECUTION */}
      <div
        className={`text-xs font-medium ${
          isTrusted
            ? "text-mintx/90"
            : isBlocked
            ? "text-red-400/90"
            : "text-yellow-400/90"
        }`}
      >
        {execution}
      </div>
    </div>
  );
}