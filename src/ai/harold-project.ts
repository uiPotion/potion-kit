/**
 * Detect a Harold static site project in the given directory and return
 * config + existing partials, pages, styles, and layouts so the AI can match patterns.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface HaroldProjectInfo {
  found: boolean;
  message?: string;
  config?: Record<string, unknown>;
  partials?: string[];
  pages?: string[];
  styles?: string[];
  blogLayouts?: string[];
  postsDir?: string;
}

const DEFAULT_CONFIG = {
  mdFilesDirName: 'posts',
  mdFilesLayoutsDirName: 'blog-layouts',
  outputDirName: 'build',
};

function readJsonSafe<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function listNames(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(ext))
      .map((f) => f.slice(0, -ext.length));
  } catch {
    return [];
  }
}

export function getHaroldProjectInfo(cwd: string): HaroldProjectInfo {
  const srcDir = join(cwd, 'src');
  if (!existsSync(srcDir)) {
    return {
      found: false,
      message: 'No src/ directory. This does not look like a Harold project. Use standard layout: src/pages, src/partials, src/styles.',
    };
  }

  const haroldrc = readJsonSafe<Record<string, unknown>>(join(cwd, '.haroldrc.json'));
  const pkg = readJsonSafe<{ harold?: Record<string, unknown> }>(join(cwd, 'package.json'));
  const config = (haroldrc ?? pkg?.harold ?? DEFAULT_CONFIG) as Record<string, unknown>;

  const mdDirName = (config.mdFilesDirName as string) ?? 'posts';
  const layoutsDirName = (config.mdFilesLayoutsDirName as string) ?? 'blog-layouts';

  const partialsDir = join(srcDir, 'partials');
  const pagesDir = join(srcDir, 'pages');
  const stylesDir = join(srcDir, 'styles');
  const blogLayoutsDir = join(srcDir, layoutsDirName);
  const postsDir = join(srcDir, mdDirName);

  const partials = listNames(partialsDir, '.hbs');
  const pages = listNames(pagesDir, '.hbs');
  const blogLayouts = listNames(blogLayoutsDir, '.hbs');

  let styles: string[] = [];
  if (existsSync(stylesDir)) {
    try {
      styles = readdirSync(stylesDir).filter(
        (f) => f.endsWith('.scss') || f.endsWith('.css')
      );
    } catch {
      // ignore
    }
  }

  return {
    found: true,
    config: {
      mdFilesDirName: mdDirName,
      mdFilesLayoutsDirName: layoutsDirName,
      outputDirName: config.outputDirName ?? 'build',
      hostDirName: config.hostDirName ?? undefined,
    },
    partials: partials.length ? partials : undefined,
    pages: pages.length ? pages : undefined,
    styles: styles.length ? styles : undefined,
    blogLayouts: blogLayouts.length ? blogLayouts : undefined,
    postsDir: existsSync(postsDir) ? mdDirName : undefined,
  };
}
