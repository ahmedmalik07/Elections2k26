import Link from "next/link";
import Avatar from "./Avatar";
import { campaign } from "@/config/campaign";
import VoteReminder from "./VoteReminder";
export default function Profile() {
  return (
    <section className="candidate-profile">
      <div className="profile-portrait">
        <Avatar />
        <span>Ahmed Malik</span>
        <small>Builder. Community person. VP candidate.</small>
      </div>
      <div className="profile-copy">
        <VoteReminder />
        <span className="section-number">Meet the person behind Jaago</span>
        <h1>
          Ahmed <span>Malik.</span>
        </h1>
        <p>Roll No. <strong>{campaign.rollNumber}</strong> · Main Campus</p>
        <p className="profile-role">
          Technical Co-Lead
          <br />
          <strong>GDGOC Air University</strong>
        </p>
        <p>
          I study Computer Games Development at Air University Islamabad, E-9. I
          like turning ideas into things people can actually use. This arcade is
          one of them.
        </p>
        <div className="credential-grid">
          <div>
            <b>4×</b>
            <span>National hackathon winner</span>
          </div>
          <div>
            <b>5</b>
            <span>Internships</span>
          </div>
          <div>
            <b>Founder</b>
            <span>Startup incubated at NIC Islamabad</span>
          </div>
          <div>
            <b>GDGOC</b>
            <span>Google Developer Groups on Campus</span>
          </div>
        </div>
        <p>
          I also run BAITHAQ in Islamabad. As Vice President, I want to bring it
          to campus every alternate week, alongside more hackathons and more
          events.
        </p>
        <div className="profile-links">
          <a
            className="button primary"
            href={campaign.linkedin}
            target="_blank"
            rel="noopener noreferrer"
          >
            Meet me on LinkedIn
          </a>
          <Link href="/arcade">Play what I built</Link>
        </div>
        <small className="profile-disclosure">
          GDGOC role is a personal credential. This is my independent student
          campaign, not an official Google, GDGOC or Air University initiative.
        </small>
      </div>
    </section>
  );
}
