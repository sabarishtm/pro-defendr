import { 
  User, InsertUser, ContentItem, InsertContentItem,
  Case, InsertCase 
} from "@shared/schema";

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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private contentItems: Map<number, ContentItem>;
  private cases: Map<number, Case>;
  private currentIds: { [key: string]: number };

  constructor() {
    this.users = new Map();
    this.contentItems = new Map();
    this.cases = new Map();
    this.currentIds = { users: 1, contentItems: 1, cases: 1 };

    // Add mock data
    this.initializeMockData();
  }

  private initializeMockData() {
    // Create mock users
    const users = [
      { username: "agent1", password: "password", name: "John Agent", role: "agent" },
      { username: "agent2", password: "password", name: "Jane Agent", role: "agent" },
    ];
    users.forEach(user => this.createUser(user));

    // Create mock content items
    const contentItems = [
      { 
        content: "This is inappropriate content #1",
        type: "text",
        priority: 2,
        metadata: { source: "social_media", reportCount: 3 }
      },
      {
        content: "This is inappropriate content #2",
        type: "text",
        priority: 1,
        metadata: { source: "comments", reportCount: 1 }
      }
    ];
    contentItems.forEach(item => this.createContentItem(item));
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentIds.users++;
    const user: User = { ...insertUser, id, status: "offline" };
    this.users.set(id, user);
    return user;
  }

  async updateUserStatus(id: number, status: string): Promise<User> {
    const user = await this.getUser(id);
    if (!user) throw new Error("User not found");
    
    const updatedUser = { ...user, status };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getContentItems(): Promise<ContentItem[]> {
    return Array.from(this.contentItems.values());
  }

  async getContentItem(id: number): Promise<ContentItem | undefined> {
    return this.contentItems.get(id);
  }

  async createContentItem(item: InsertContentItem): Promise<ContentItem> {
    const id = this.currentIds.contentItems++;
    const contentItem: ContentItem = { 
      ...item, 
      id, 
      status: "pending",
      assignedTo: null 
    };
    this.contentItems.set(id, contentItem);
    return contentItem;
  }

  async updateContentItem(id: number, updates: Partial<ContentItem>): Promise<ContentItem> {
    const item = await this.getContentItem(id);
    if (!item) throw new Error("Content item not found");

    const updatedItem = { ...item, ...updates };
    this.contentItems.set(id, updatedItem);
    return updatedItem;
  }

  async getCases(): Promise<Case[]> {
    return Array.from(this.cases.values());
  }

  async getCase(id: number): Promise<Case | undefined> {
    return this.cases.get(id);
  }

  async createCase(caseData: InsertCase): Promise<Case> {
    const id = this.currentIds.cases++;
    const newCase: Case = { ...caseData, id, status: "open" };
    this.cases.set(id, newCase);
    return newCase;
  }

  async updateCase(id: number, updates: Partial<Case>): Promise<Case> {
    const existingCase = await this.getCase(id);
    if (!existingCase) throw new Error("Case not found");

    const updatedCase = { ...existingCase, ...updates };
    this.cases.set(id, updatedCase);
    return updatedCase;
  }
}

export const storage = new MemStorage();
