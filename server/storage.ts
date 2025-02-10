import { 
  users, contentItems, cases,
  type User, type InsertUser, 
  type ContentItem, type InsertContentItem,
  type Case, type InsertCase 
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { contentClassifier } from "./lib/ai-classifier";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStatus(id: number, status: string): Promise<User>;

  // Content operations  
  getContentItems(): Promise<ContentItem[]>;
  getContentItem(id: number): Promise<ContentItem | undefined>;
  createContentItem(item: InsertContentItem): Promise<ContentItem>;
  updateContentItem(id: number, updates: Partial<ContentItem>): Promise<ContentItem>;

  // Case operations
  getCases(): Promise<Case[]>;
  getCase(id: number): Promise<Case | undefined>;
  createCase(caseData: InsertCase): Promise<Case>;
  updateCase(id: number, updates: Partial<Case>): Promise<Case>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserStatus(id: number, status: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ status })
      .where(eq(users.id, id))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async getContentItems(): Promise<ContentItem[]> {
    return db.select().from(contentItems);
  }

  async getContentItem(id: number): Promise<ContentItem | undefined> {
    const [item] = await db.select().from(contentItems).where(eq(contentItems.id, id));
    return item;
  }

  async createContentItem(item: InsertContentItem): Promise<ContentItem> {
    // Get AI classification before storing
    const classification = await contentClassifier.classifyContent(item.content, item.type);

    const metadata: ContentMetadata = {
      ...item.metadata,
      aiClassification: classification
    };

    const [contentItem] = await db
      .insert(contentItems)
      .values({ 
        ...item, 
        status: "pending", 
        assignedTo: null,
        metadata
      })
      .returning();
    return contentItem;
  }

  async updateContentItem(id: number, updates: Partial<ContentItem>): Promise<ContentItem> {
    const [item] = await db
      .update(contentItems)
      .set(updates)
      .where(eq(contentItems.id, id))
      .returning();
    if (!item) throw new Error("Content item not found");
    return item;
  }

  async getCases(): Promise<Case[]> {
    return db.select().from(cases);
  }

  async getCase(id: number): Promise<Case | undefined> {
    const [case_] = await db.select().from(cases).where(eq(cases.id, id));
    return case_;
  }

  async createCase(caseData: InsertCase): Promise<Case> {
    const [newCase] = await db
      .insert(cases)
      .values({ ...caseData, status: "open" })
      .returning();
    return newCase;
  }

  async updateCase(id: number, updates: Partial<Case>): Promise<Case> {
    const [case_] = await db
      .update(cases)
      .set(updates)
      .where(eq(cases.id, id))
      .returning();
    if (!case_) throw new Error("Case not found");
    return case_;
  }
}

export const storage = new DatabaseStorage();