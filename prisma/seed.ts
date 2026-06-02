import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const hash = await bcrypt.hash("Password123!", 12);

  // Demo users
  const users = [
    { name: "Alice Johnson", username: "alice", email: "alice@demo.com" },
    { name: "Bob Smith",     username: "bob",   email: "bob@demo.com"   },
    { name: "Carol White",   username: "carol", email: "carol@demo.com" },
  ];

  const coverColors = ["#5B5FEF", "#7C3AED", "#0EA5E9"];

  const created = [];
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash: hash,
        emailVerified: true,
        profile: {
          create: {
            name: u.name,
            username: u.username,
            bio: `Hey there, I'm ${u.name.split(" ")[0]}! 👋`,
            coverColor: coverColors[i],
          },
        },
        settings: { create: {} },
      },
    });
    created.push(user);
    console.log(`  ✅ User: ${u.email}`);
  }

  // Friendship between Alice and Bob
  await prisma.friendship.upsert({
    where: { userAId_userBId: { userAId: created[0].id, userBId: created[1].id } },
    update: {},
    create: { userAId: created[0].id, userBId: created[1].id, status: "ACCEPTED" },
  });

  // Sample direct chat
  const existingChat = await prisma.chat.findFirst({
    where: {
      type: "DIRECT",
      AND: [
        { members: { some: { userId: created[0].id } } },
        { members: { some: { userId: created[1].id } } },
      ],
    },
  });

  if (!existingChat) {
    const chat = await prisma.chat.create({
      data: {
        type: "DIRECT",
        members: { create: [{ userId: created[0].id }, { userId: created[1].id }] },
      },
    });

    await prisma.message.create({
      data: {
        chatId: chat.id,
        senderId: created[0].id,
        content: "Hey Bob! Welcome to Message Hub 🎉",
        type: "TEXT",
      },
    });
    await prisma.message.create({
      data: {
        chatId: chat.id,
        senderId: created[1].id,
        content: "Thanks Alice! This looks great 😊",
        type: "TEXT",
      },
    });
    console.log("  ✅ Sample chat + messages");
  }

  // Sample community
  const community = await prisma.community.upsert({
    where: { inviteCode: "DEMO01" },
    update: {},
    create: {
      name: "Message Hub Community",
      description: "Welcome to the official Message Hub community!",
      bannerColor: "#5B5FEF",
      iconColor: "#7C3AED",
      category: "Technology",
      inviteCode: "DEMO01",
      createdById: created[0].id,
      memberCount: 1,
      members: { create: { userId: created[0].id, role: "OWNER" } },
      channels: {
        create: [
          { name: "general", isDefault: true },
          { name: "announcements" },
          { name: "random" },
        ],
      },
    },
  });
  console.log("  ✅ Sample community");

  console.log("\n✅ Seed complete!");
  console.log("\nDemo accounts (password: Password123!):");
  users.forEach((u) => console.log(`  ${u.email}`));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
