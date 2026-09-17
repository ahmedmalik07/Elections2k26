import Link from "next/link";
export default function BuilderStrip() {
  return (
    <Link href="/ahmed" className="builder-strip">
      <img
        src="/ahmed.png"
        alt="Ahmed Malik"
        width="72"
        height="72"
        loading="lazy"
        decoding="async"
      />
      <div>
        <small>Built by</small>
        <strong>Ahmed Malik</strong>
        <span>Technical Co-Lead, GDGOC Air University</span>
      </div>
      <b>Meet Ahmed</b>
    </Link>
  );
}
