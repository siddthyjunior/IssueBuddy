import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@issuebuddy.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "ChangeMe123!";
  const name = process.env.ADMIN_NAME || "IssueBuddy Admin";
  if (password.length < 10) throw new Error("ADMIN_PASSWORD must contain at least 10 characters.");
  let admin = await prisma.user.findUnique({ where: { email } });
  if (!admin) {
    admin = await prisma.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 12), role: "ADMIN" } });
    console.log(`Created initial administrator: ${email}`);
  } else if (admin.role !== "ADMIN") {
    admin = await prisma.user.update({ where: { id: admin.id }, data: { role: "ADMIN" } });
    console.log(`Promoted configured account to ADMIN: ${email}`);
  }

  let project = await prisma.project.findUnique({ where: { key: "DEMO" } });
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: "IssueBuddy Demo", key: "DEMO", description: "A sample project to explore the IssueBuddy workflow.", nextIssueNumber: 5,
        owner: { connect: { id: admin.id } },
        members: { create: { user: { connect: { id: admin.id } }, role: "MANAGER" } },
        labels: { create: [
          { name: "bug", color: "#ef657b" },
          { name: "feature", color: "#7e9bfa" },
          { name: "documentation", color: "#a88af2" }
        ] }
      }
    });
    const labels = await prisma.label.findMany({ where: { projectId: project.id } });
    const now = new Date();
    const seeds = [
      ["Login button not working", "Clicking the login button does nothing on Chrome.", "OPEN", "HIGH", "bug"],
      ["Add dark mode support", "Users requested a theme toggle.", "IN_PROGRESS", "MEDIUM", "feature"],
      ["Fix typo in About page", "The word 'organisation' is misspelled.", "REVIEW", "LOW", "documentation"],
      ["Database backup automation", "Add a nightly backup job for the production database.", "OPEN", "URGENT", "feature"]
    ];
    for (const [index, item] of seeds.entries()) {
      const issue = await prisma.issue.create({
        data: {
          issueKey: `DEMO-${index + 1}`, title: item[0], description: item[1], status: item[2], priority: item[3],
          project: { connect: { id: project.id } }, reporter: { connect: { id: admin.id } }, assignee: { connect: { id: admin.id } },
          labels: { create: [{ label: { connect: { id: labels.find((label) => label.name === item[4]).id } } }] },
          createdAt: new Date(now.getTime() - (index + 1) * 86400000)
        }
      });
      await prisma.activityLog.create({ data: { issueId: issue.id, actorId: admin.id, action: "ISSUE_CREATED", details: { seeded: true } } });
    }
    console.log("Created DEMO project and sample issues.");
  } else {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: admin.id } },
      create: { projectId: project.id, userId: admin.id, role: "MANAGER" },
      update: { role: "MANAGER" }
    });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
