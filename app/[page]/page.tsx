import CampusApp from "@/components/CampusApp";
import { notFound } from "next/navigation";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ page: string }>;
  searchParams: Promise<{ game?: string }>;
}) {
  const { page } = await params;
  if (
    !["play", "arcade", "ahmed", "leaderboard", "print", "admin"].includes(page)
  )
    notFound();
  return (
    <CampusApp
      key={page + (await searchParams).game}
      page={page}
      initialMode={(await searchParams).game}
    />
  );
}
