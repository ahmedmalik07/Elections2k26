export const campaign = {
  candidateName: "Ahmed Malik",
  rollNumber: "241981",
  position: "Vice President, GDGOC Air University",
  university: "Air University Islamabad, E-9",
  slogan: "Campus bore nahi hoga.",
  ballotNumber: "",
  votingDate: "2026-09-21T00:00:00+05:00",
  votingEndDate: "2026-09-22T23:59:59+05:00",
  votingLabel: "21 & 22 September 2026",
  linkedin: "https://linkedin.com/in/ahhmedmalik",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://ahmedmalik.wyibe.com",
  showBaithaqProof: true,
  gameDurationSec: 45,
  departments: [
    "Computing & AI",
    "Engineering",
    "Aerospace & Aviation",
    "Management",
    "Social Sciences",
    "Basic & Applied Sciences",
    "Other",
  ],
};
export const cards = [
  {
    id: "chair",
    title: "Baithaq",
    headline: "Har doosre hafte. Chhota group. Naye log.",
    body: "Hum 4 saal apne same 5 doston ke saath guzaar dete hain, aur campus ke hazaron logon se kabhi milte hi nahi. Baithaq ek chhoti si gathering hai: alag alag departments ke students, ek circle mein. Koi stage nahi, koi speech nahi, koi networking wali cringe nahi. Har banda ek cheez laata hai: ek idea, ek story, ya ek experience. Baat hoti hai, aur connection khud ban jaata hai.",
    why: "Tumhara next co-founder, best friend ya hackathon teammate shayad doosri building mein baitha hai.",
    proof:
      "Yeh sirf waada nahi. BAITHAQ Islamabad mein already chal rahi hai. VP ban ke main isay har student tak laaunga, har doosre hafte.",
  },
  {
    id: "trophy",
    title: "More hackathons",
    headline: "4 national hackathons jeete hain. Ab campus pe karwaunga.",
    body: "Hackathon mein ek din mein idea se product banta hai, aur log ek semester se zyada seekh jaate hain. Main 4 national hackathons jeet chuka hoon, is liye pata hai acha hackathon kaise chalta hai. Plan simple hai: campus pe zyada hackathons, taake competition dhoondhne bahar na jaana pare.",
  },
  {
    id: "mic",
    title: "More events",
    headline: "Semester sirf quizzes aur deadlines nahi hona chahiye.",
    body: "Zyada events, zyada fun, campus aane ki zyada wajah. GDGOC Air University ka Technical Co-Lead hoon, events banana aur chalana mera roz ka kaam hai.",
  },
  {
    id: "chai",
    title: "Kaun hai Ahmed?",
    headline: "Yeh game bhi chai pe bana hai.",
    body: "Computer Games Development student.\n4× national hackathon winner.\nFounder, startup incubated at NIC Islamabad.\n5 internships.\nTechnical Co-Lead, GDGOC Air University.",
    why: "Waade sab karte hain. Main cheezein bana ke dikhata hoon.",
  },
];
export function rankTitle(score: number) {
  return score >= 700
    ? "Baithaq legend"
    : score >= 450
      ? "Hackathon material"
      : score >= 250
        ? "Society ka banda"
        : score >= 100
          ? "Canteen regular"
          : "Certified bore";
}
