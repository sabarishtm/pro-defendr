import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Content Region Types for Moderation
export const contentRegionSchema = z.object({
  type: z.string(),
  confidence: z.number(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export type ContentRegion = z.infer<typeof contentRegionSchema>;

// Video Timeline Types
export const videoOutputSchema = z.object({
  time: z.number(),
  confidence: z.record(z.number()),
  thumbnail: z.string().nullable().optional(),
});

export type VideoOutput = z.infer<typeof videoOutputSchema>;

// AI Analysis Types
export const aiAnalysisSchema = z.object({
  classification: z.object({
    category: z.string(),
    confidence: z.number(),
    suggestedAction: z.enum(["approve", "reject", "review"]),
  }),
  contentFlags: z.array(z.object({
    type: z.string(),
    severity: z.number(),
    details: z.string(),
  })),
  riskScore: z.number(),
  regions: z.array(contentRegionSchema).optional(),
  timeline: z.array(videoOutputSchema).optional(),
});

export type AIAnalysis = z.infer<typeof aiAnalysisSchema>;

// Settings Types
export const ModerationType = {
  OPENAI: "openai",
  THEHIVE: "thehive",
} as const;

export type ModerationType = typeof ModerationType[keyof typeof ModerationType];

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at"),
});

export const insertSettingsSchema = createInsertSchema(settings);

export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;


// Add Content Status enum before the contentItems definition
export const ContentStatus = {
  PENDING_MODERATION: "pending_moderation",
  REJECTED: "rejected",
  APPROVED: "approved",
  SECONDARY_REVIEW: "secondary_review",
} as const;

export type ContentStatus = typeof ContentStatus[keyof typeof ContentStatus];

// Update contentItems table definition
export const contentItems = pgTable("content_items", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  type: text("type").notNull(), // text, image, video
  status: text("status", { enum: Object.values(ContentStatus) })
    .notNull()
    .default(ContentStatus.PENDING_MODERATION),
  priority: integer("priority").notNull().default(1),
  assignedTo: integer("assigned_to").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  metadata: jsonb("metadata").notNull().$type<{
    aiAnalysis?: AIAnalysis;
    originalMetadata: Record<string, unknown>;
  }>(),
});

// Role and Permission Types
export const UserRole = {
  AGENT: "agent",
  SR_AGENT: "sr_agent",
  QUEUE_MANAGER: "queue_manager",
  ADMIN: "admin",
} as const;

export const Permission = {
  REVIEW_CONTENT: "review_content",
  ASSIGN_CONTENT: "assign_content",
  MANAGE_USERS: "manage_users",
  VIEW_REPORTS: "view_reports",
  MANAGE_SETTINGS: "manage_settings",
  OVERRIDE_DECISIONS: "override_decisions",
} as const;

// Role permissions mapping
export const RolePermissions = {
  [UserRole.AGENT]: [
    Permission.REVIEW_CONTENT,
  ],
  [UserRole.SR_AGENT]: [
    Permission.REVIEW_CONTENT,
    Permission.OVERRIDE_DECISIONS,
  ],
  [UserRole.QUEUE_MANAGER]: [
    Permission.REVIEW_CONTENT,
    Permission.ASSIGN_CONTENT,
    Permission.VIEW_REPORTS,
  ],
  [UserRole.ADMIN]: [
    Permission.MANAGE_USERS,
    Permission.MANAGE_SETTINGS,
  ],
} as const;

// User Types
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role", { enum: Object.values(UserRole) }).notNull().default(UserRole.AGENT),
  status: text("status").notNull().default("offline"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
  teamId: integer("team_id").references(() => teams.id),
});

// Team Types
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
  managerId: integer("manager_id").references(() => users.id),
});

// Moderation Case Types
export const cases = pgTable("cases", {
  id: serial("id").primaryKey(),
  contentId: integer("content_id").references(() => contentItems.id).notNull(),
  agentId: integer("agent_id").references(() => users.id),
  status: text("status").notNull().default("open"),
  notes: text("notes"),
  decision: text("decision"), // approved, rejected
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Schema Types
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  email: true,
  role: true,
  teamId: true,
});

export const insertContentSchema = createInsertSchema(contentItems)
  .pick({
    content: true,
    type: true,
    priority: true,
    metadata: true,
  })
  .extend({
    metadata: z.object({
      aiAnalysis: aiAnalysisSchema.optional(),
      originalMetadata: z.record(z.unknown()),
    }),
  });

export const insertCaseSchema = createInsertSchema(cases).pick({
  contentId: true,
  agentId: true,
  notes: true,
  decision: true,
});

export const insertTeamSchema = createInsertSchema(teams).pick({
  name: true,
  description: true,
  managerId: true,
});

// Decision Types
export const decisionSchema = z.object({
  contentId: z.number(),
  decision: z.enum(["approve", "reject", "review"]),
  notes: z.string().optional(),
});

export type Decision = z.infer<typeof decisionSchema>;

// Export additional types
export type UserPermission = typeof Permission[keyof typeof Permission];
export type UserRoleType = typeof UserRole[keyof typeof UserRole];
export type RolePermissionsType = typeof RolePermissions;
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

// Export Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type ContentItem = typeof contentItems.$inferSelect;
export type InsertContentItem = z.infer<typeof insertContentSchema>;
export type Case = typeof cases.$inferSelect;
export type InsertCase = z.infer<typeof insertCaseSchema>;
export type ModerationCase = Case;

// Login Types
export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
});

export type LoginData = z.infer<typeof loginSchema>;