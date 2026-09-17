import Link from "next/link";
import { campaign } from "@/config/campaign";
export default function VoteReminder({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <Link
      href="/ahmed"
      className={"vote-reminder " + (compact ? "compact" : "")}
      aria-label={`Vote ${campaign.candidateName}, Roll No. ${campaign.rollNumber}, for ${campaign.position}, ${campaign.votingLabel}`}
    >
      <span className="vote-mark" aria-hidden="true">
        <svg
          viewBox="0 0 32 32"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <rect x="4" y="5" width="23" height="23" rx="2" />
          <path d="m9 16 5 5L29 5" />
        </svg>
      </span>
      <span>
        <strong>Vote {campaign.candidateName}</strong>
        <small>Roll No. {campaign.rollNumber}</small>
        <small>{campaign.position}</small>
        <b>{campaign.votingLabel}</b>
      </span>
    </Link>
  );
}
