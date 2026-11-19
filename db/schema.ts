import {sqliteTable,text} from 'drizzle-orm/sqlite-core';
export const reports=sqliteTable('reports',{id:text('id').primaryKey(),owner:text('owner').notNull(),payload:text('payload').notNull(),created:text('created').notNull()});
