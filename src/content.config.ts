import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const articleSchema = z.object({
  title: z.string().min(8).max(120),
  h1: z.string().min(4).max(120).optional(),
  description: z.string().min(40).max(220),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  section: z.enum(['articles', 'biografii', 'hard-texts', 'nagornaya', 'baptisty-rossii']),
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  author: z.string().default('fedor-milovanov'),
  series: z.string().optional(),
  tags: z.array(z.string().min(1).max(48)).default([]),
  related: z.array(z.string().regex(/^[a-z0-9-]+$/)).default([]),
  ogImage: z.string().optional(),
  ogImageAlt: z.string().optional(),
  draft: z.boolean().default(false),
  noindex: z.boolean().default(false),
  sourcesRequired: z.boolean().default(true),
  canonicalOverride: z.url().optional(),
  readingTime: z.number().int().positive().optional(),
  sourceMode: z.enum(['rendered', 'metadata-only']).default('rendered'),
}).superRefine((data, ctx) => {
  if (data.ogImage && !data.ogImageAlt) {
    ctx.addIssue({
      code: 'custom',
      path: ['ogImageAlt'],
      message: 'ogImageAlt обязателен, если задан ogImage',
    });
  }
  if (data.updatedAt && data.updatedAt < data.publishedAt) {
    ctx.addIssue({
      code: 'custom',
      path: ['updatedAt'],
      message: 'updatedAt не может быть раньше publishedAt',
    });
  }
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: articleSchema,
});

export const collections = { articles };
