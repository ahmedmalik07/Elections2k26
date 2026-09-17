import CampusApp from "@/components/CampusApp";
import CampusRunner from "@/components/CampusRunner";
import { campaign } from "@/config/campaign";
import { getChallenge } from "@/lib/server";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const challenge = c ? await getChallenge(c).catch(() => null) : null;
  return challenge
    ? {
        openGraph: {
          title: `${challenge.nickname} ne ${challenge.score} kiya. Beat kar sakte ho?`,
          images: [`${campaign.siteUrl}/api/og?c=${encodeURIComponent(c!)}`],
        },
      }
    : {};
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  return c ? <CampusApp page="home" /> : <CampusRunner />;
}
