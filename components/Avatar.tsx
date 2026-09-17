"use client";
import { useState } from "react";
export default function Avatar() {
  const [failed, setFailed] = useState(false);
  return (
    <div className="candidate-avatar">
      {!failed ? (
        <img
          src="/ahmed-speaking.jpg"
          alt="Ahmed Malik"
          width="90"
          height="90"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <svg
          viewBox="0 0 90 90"
          role="img"
          aria-label="Illustrated Ahmed avatar with a GDG-style lanyard"
        >
          <circle cx="45" cy="45" r="43" fill="#ffc20e" />
          <path
            d="M16 88V69Q16 49 45 49Q74 49 74 69V88"
            fill="#2356d8"
            stroke="#1d2a5c"
            strokeWidth="3"
          />
          <circle
            cx="45"
            cy="32"
            r="21"
            fill="#e9b889"
            stroke="#1d2a5c"
            strokeWidth="3"
          />
          <path
            d="M23 29Q18 4 47 9Q70 7 66 28L55 20L44 25L32 20Z"
            fill="#1d2a5c"
          />
          <path
            d="M33 57L45 77L58 57"
            stroke="#e4312b"
            strokeWidth="5"
            fill="none"
          />
          <rect
            x="35"
            y="72"
            width="21"
            height="15"
            rx="2"
            fill="#f8f4e9"
            stroke="#1d2a5c"
            strokeWidth="2"
          />
          <circle cx="38" cy="33" r="2" fill="#1d2a5c" />
          <circle cx="52" cy="33" r="2" fill="#1d2a5c" />
          <path
            d="M38 42Q45 47 52 42"
            stroke="#1d2a5c"
            strokeWidth="2"
            fill="none"
          />
        </svg>
      )}
    </div>
  );
}
