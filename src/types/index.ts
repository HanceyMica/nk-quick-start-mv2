export interface GridItem {
  id: string;
  label: string;
  type: 'url' | 'grid';
  url?: string;
  grid?: GridItem[];
}

export interface ExpertItem {
  id: string;
  code: string;
  label: string;
  url: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Config {
  version: number;
  mode: 'simple' | 'expert';
  expertShortcut: string;
  themeMode: ThemeMode;
  items: GridItem[];
  expertItems: ExpertItem[];
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function createDefaultGridItem(index: number): GridItem {
  return {
    id: generateId(),
    label: `网站${index + 1}`,
    type: 'url',
    url: ''
  };
}

export function createDefaultExpertItem(index: number): ExpertItem {
  return {
    id: generateId(),
    code: String(index + 1),
    label: `网址${index + 1}`,
    url: ''
  };
}

export function createDefaultConfig(): Config {
  const defaultUrls = [
    { label: '百度', url: 'https://www.baidu.com' },
    { label: '谷歌', url: 'https://www.google.com' },
    { label: 'GitHub', url: 'https://www.github.com' },
    { label: '知乎', url: 'https://www.zhihu.com' },
    { label: 'B站', url: 'https://www.bilibili.com' },
    { label: '微博', url: 'https://www.weibo.com' },
    { label: '淘宝', url: 'https://www.taobao.com' },
    { label: '京东', url: 'https://www.jd.com' },
    { label: '网易', url: 'https://www.163.com' }
  ];

  return {
    version: 3,
    mode: 'simple',
    expertShortcut: 'Alt+1',
    themeMode: 'system',
    items: defaultUrls.map((item) => ({
      id: generateId(),
      label: item.label,
      type: 'url' as const,
      url: item.url
    })),
    expertItems: defaultUrls.map((item, index) => ({
      id: generateId(),
      code: String(index + 1),
      label: item.label,
      url: item.url
    }))
  };
}

export function createEmptyGrid(): GridItem[] {
  return Array.from({ length: 9 }, (_, i) => createDefaultGridItem(i));
}
