import { 
  users, contentItems, cases,
  type User, type InsertUser, 
  type ContentItem, type InsertContentItem,
  type Case, type InsertCase 
} from "@shared/schema";
import { db } from "./db";
import { eq, isNull } from "drizzle-orm";

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
  getNextContentItem(): Promise<ContentItem | undefined>;
  deleteContentItem(id: number): Promise<void>;

  // Case operations
  getCases(): Promise<Case[]>;
  getCase(id: number): Promise<Case | undefined>;
  createCase(caseData: InsertCase): Promise<Case>;
  updateCase(id: number, updates: Partial<Case>): Promise<Case>;
  // Add new method to get assigned user info
  getContentItemWithAssignedUser(contentId: number): Promise<ContentItem & { assignedUserName?: string }>;
  getContentItemsWithAssignedUsers(): Promise<(ContentItem & { assignedUserName?: string })[]>;
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
    const items = await db
      .select()
      .from(contentItems)
      .orderBy(contentItems.priority);
    console.log("Fetched content items:", items);
    return items;
  }

  async getContentItem(id: number): Promise<ContentItem | undefined> {
    const [item] = await db.select().from(contentItems).where(eq(contentItems.id, id));
    return item;
  }

  async createContentItem(item: InsertContentItem): Promise<ContentItem> {
    const [contentItem] = await db
      .insert(contentItems)
      .values({ ...item, status: "pending", assignedTo: null })
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

  async getNextContentItem(): Promise<ContentItem | undefined> {
    // Get the next unassigned content item that's pending review
    const [nextItem] = await db
      .select()
      .from(contentItems)
      .where(eq(contentItems.status, "pending"))
      .where(isNull(contentItems.assignedTo))
      .limit(1);

    return nextItem;
  }

  async deleteContentItem(id: number): Promise<void> {
    // First delete all related cases, then delete the content item in a transaction
    await db.transaction(async (tx) => {
      // Delete all cases associated with this content
      await tx.delete(cases).where(eq(cases.contentId, id));
      // Then delete the content item
      await tx.delete(contentItems).where(eq(contentItems.id, id));
    });
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
  async getContentItemWithAssignedUser(id: number): Promise<ContentItem & { assignedUserName?: string }> {
    const [item] = await db.select().from(contentItems).where(eq(contentItems.id, id));
    if (!item) return item;

    if (item.assignedTo) {
      const user = await this.getUser(item.assignedTo);
      return { ...item, assignedUserName: user?.name };
    }
    return { ...item, assignedUserName: undefined };
  }

  async getContentItemsWithAssignedUsers(): Promise<(ContentItem & { assignedUserName?: string })[]> {
    const items = await db
      .select()
      .from(contentItems)
      .orderBy((cols) => [cols.createdAt])
      .prepare();

    const itemsWithUsers = await Promise.all(
      items.map(async (item) => {
        if (item.assignedTo) {
          const user = await this.getUser(item.assignedTo);
          return { ...item, assignedUserName: user?.name };
        }
        return { ...item, assignedUserName: undefined };
      })
    );
    return itemsWithUsers;
  }
}

export const storage = new DatabaseStorage();