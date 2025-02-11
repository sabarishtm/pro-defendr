import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
});

export type AIAnalysis = z.infer<typeof aiAnalysisSchema>;

// User Types
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("agent"),
  status: text("status").notNull().default("offline"),
});

// Content Types
export const contentItems = pgTable("content_items", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  type: text("type").notNull(), // text, image, video
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  priority: integer("priority").notNull().default(1),
  assignedTo: integer("assigned_to").references(() => users.id),
  name: text("name"), // Add name field
  metadata: jsonb("metadata").notNull().$type<{
    aiAnalysis?: AIAnalysis;
    originalMetadata: Record<string, unknown>;
  }>(),
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
  role: true,
});

export const insertContentSchema = createInsertSchema(contentItems)
  .pick({
    content: true,
    type: true,
    priority: true,
    metadata: true,
    name: true, // Add name to schema
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

// Decision Types
export const decisionSchema = z.object({
  contentId: z.number(),
  decision: z.enum(["approve", "reject"]),
  notes: z.string().optional(),
});

export type Decision = z.infer<typeof decisionSchema>;


// Export Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type ContentItem = typeof contentItems.$inferSelect;
export type InsertContentItem = z.infer<typeof insertContentSchema>;
export type Case = typeof cases.$inferSelect;
export type InsertCase = z.infer<typeof insertCaseSchema>;
export type ModerationCase = Case; // Add this export for the ModerationCase type

// Login Types
export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
});

export type LoginData = z.infer<typeof loginSchema>;