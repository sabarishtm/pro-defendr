import { content, type Content, type InsertContent, type QueueStats, contentTypes, moderationStatuses } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  getContent(id: number): Promise<Content | undefined>;
  getAllContent(): Promise<Content[]>;
  createContent(item: InsertContent): Promise<Content>;
  updateContent(id: number, update: Partial<Content>): Promise<Content | undefined>;
  deleteContent(id: number): Promise<void>;
  getQueueStats(): Promise<QueueStats>;
  submitAIFeedback(id: number, isCorrect: boolean, notes?: string): Promise<Content>;
}

export class DatabaseStorage implements IStorage {
  async getContent(id: number): Promise<Content | undefined> {
    const [item] = await db.select().from(content).where(eq(content.id, id));
    return item;
  }

  async getAllContent(): Promise<Content[]> {
    return db.select().from(content).orderBy(desc(content.queuedAt));
  }

  async createContent(item: InsertContent): Promise<Content> {
    const [created] = await db.insert(content).values({
      ...item,
      status: "pending",
      queuedAt: new Date(),
      offensiveRegions: "[]",
      aiConfidence: "{}",
      moderationMetrics: "{}",
    }).returning();
    return created;
  }

  async updateContent(id: number, update: Partial<Content>): Promise<Content | undefined> {
    if (update.status) {
      update.moderatedAt = new Date();
      update.humanDecision = update.status;
    }

    const [updated] = await db
      .update(content)
      .set(update)
      .where(eq(content.id, id))
      .returning();
    return updated;
  }

  async deleteContent(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      // First delete related annotations
      await tx.execute(
        sql`DELETE FROM content_annotations WHERE content_id = ${id}`
      );

      // Then delete the content itself
      await tx.delete(content)
        .where(eq(content.id, id));
    });
  }

  async submitAIFeedback(id: number, isCorrect: boolean, notes?: string): Promise<Content> {
    const [updated] = await db
      .update(content)
      .set({
        feedbackProvided: true,
        feedbackNotes: notes || null,
        feedbackTimestamp: new Date(),
      })
      .where(eq(content.id, id))
      .returning();
    return updated;
  }

  async getQueueStats(): Promise<QueueStats> {
    const items = await this.getAllContent();

    const byStatus = Object.fromEntries(
      moderationStatuses.map(status => [
        status,
        items.filter(item => item.status === status).length
      ])
    ) as Record<Content["status"], number>;

    const byType = Object.fromEntries(
      contentTypes.map(type => [
        type,
        items.filter(item => item.type === type).length
      ])
    ) as Record<Content["type"], number>;

    const processedItems = items.filter(item => item.moderatedAt);
    const avgProcessingTime = processedItems.length > 0
      ? processedItems.reduce((acc, item) => {
          if (!item.moderatedAt || !item.queuedAt) return acc;
          return acc + (new Date(item.moderatedAt).getTime() - new Date(item.queuedAt).getTime());
        }, 0) / processedItems.length
      : 0;

    const itemsWithFeedback = items.filter(item => item.feedbackProvided);
    const totalFeedback = itemsWithFeedback.length;

    const agreementCount = itemsWithFeedback.filter(
      item => item.aiDecision === item.humanDecision
    ).length;

    const aiFeedbackStats = {
      totalFeedback,
      agreementRate: totalFeedback > 0 ? agreementCount / totalFeedback : 0,
      disagreementRate: totalFeedback > 0 ? (totalFeedback - agreementCount) / totalFeedback : 0,
    };

    const aiAccuracy = aiFeedbackStats.agreementRate || 0.92; // Fallback to default if no feedback

    const flaggedContentRatio = items.length > 0
      ? items.filter(item => item.status === "flagged").length / items.length
      : 0;

    const now = new Date();
    const moderationTrends = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const dayItems = items.filter(item =>
        item.moderatedAt &&
        new Date(item.moderatedAt).toISOString().split('T')[0] === date
      );

      return {
        date,
        approved: dayItems.filter(item => item.status === "approved").length,
        rejected: dayItems.filter(item => item.status === "rejected").length,
        flagged: dayItems.filter(item => item.status === "flagged").length
      };
    }).reverse();

    const contentTypeDistribution = contentTypes.map(type => {
      const typeItems = items.filter(item => item.type === type);
      const typeProcessedItems = typeItems.filter(item => item.moderatedAt && item.queuedAt);
      const avgTypeProcessingTime = typeProcessedItems.length > 0
        ? typeProcessedItems.reduce((acc, item) => {
            if (!item.moderatedAt || !item.queuedAt) return acc;
            return acc + (new Date(item.moderatedAt).getTime() - new Date(item.queuedAt).getTime());
          }, 0) / typeProcessedItems.length
        : 0;

      return {
        type,
        count: typeItems.length,
        avgProcessingTime: avgTypeProcessingTime
      };
    });

    return {
      byStatus,
      byType,
      total: items.length,
      avgProcessingTime,
      aiAccuracy,
      flaggedContentRatio,
      moderationTrends,
      contentTypeDistribution,
      aiFeedbackStats
    };
  }
}

export const storage = new DatabaseStorage();