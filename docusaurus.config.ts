import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Neo4j 완벽 가이드',
  tagline: '초급부터 고급까지, Neo4j 그래프 데이터베이스의 모든 것',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://mypalesong.github.io',
  baseUrl: '/docu/',

  organizationName: 'mypalesong',
  projectName: 'docu',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'ko',
    locales: ['ko'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/neo4j-social-card.jpg',
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Neo4j 가이드',
      logo: {
        alt: 'Neo4j Guide Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: '문서',
        },
        {
          href: 'https://neo4j.com',
          label: 'Neo4j 공식',
          position: 'right',
        },
        {
          href: 'https://github.com/mypalesong/docu',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: '문서',
          items: [
            {
              label: '시작하기',
              to: '/',
            },
            {
              label: '초급',
              to: '/beginner/introduction',
            },
            {
              label: '중급',
              to: '/intermediate/data-modeling',
            },
            {
              label: '고급',
              to: '/advanced/graph-algorithms',
            },
          ],
        },
        {
          title: 'Neo4j 커뮤니티',
          items: [
            {
              label: 'Neo4j Community',
              href: 'https://community.neo4j.com',
            },
            {
              label: 'GraphAcademy',
              href: 'https://graphacademy.neo4j.com',
            },
            {
              label: 'Discord',
              href: 'https://discord.gg/neo4j',
            },
          ],
        },
        {
          title: '더 알아보기',
          items: [
            {
              label: 'Neo4j 공식 문서',
              href: 'https://neo4j.com/docs/',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/neo4j/neo4j',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Neo4j Guide. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['cypher', 'bash', 'python', 'java', 'javascript', 'typescript', 'json', 'yaml', 'properties'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
