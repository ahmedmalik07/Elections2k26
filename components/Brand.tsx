import Link from "next/link";

// Campaign mark: a ballot tick badge beside the candidate's name.
export default function Brand() {
  return (
    <Link
      href="/"
      className="campaign-brand"
      aria-label="Ahmed Malik for Vice President, GDGOC Air University: home"
    >
      <span className="campaign-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <path
            d="m8 16.5 5.5 5.5L25 10"
            stroke="currentColor"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="campaign-name">
        <strong>Ahmed Malik</strong>
        <small>for VP · GDGOC AU</small>
      </span>
    </Link>
  );
}
