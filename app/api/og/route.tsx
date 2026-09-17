import { ImageResponse } from "next/og";
import { getChallenge } from "@/lib/server";
import { gameInfo } from "@/lib/arcade.mjs";
import { campaign } from "@/config/campaign";
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("c");
  const c = code ? await getChallenge(code).catch(() => null) : null;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#FFC20E",
        color: "#1D2A5C",
        display: "flex",
        flexDirection: "column",
        padding: 70,
        border: "24px solid #E4312B",
        justifyContent: "center",
      }}
    >
      <div style={{ fontSize: 100, fontWeight: 900 }}>Jaago Campus</div>
      <div style={{ fontSize: 45, marginTop: 30 }}>
        {c
          ? `${c.nickname} ne ${gameInfo(c.mode).name} mein ${c.score} kiya. Beat kar sakte ho?`
          : "Sab ne poster lagaye. Ahmed ne game bana diya."}
      </div>
      <div style={{ fontSize: 28, marginTop: 45 }}>
        {`Vote ${campaign.candidateName} for ${campaign.position}`}
      </div>
      <div style={{ fontSize: 26, marginTop: 16 }}>{campaign.votingLabel}</div>
    </div>,
    { width: 1200, height: 630 },
  );
}
