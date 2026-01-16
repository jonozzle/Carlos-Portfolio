// sanity/lib/fetch.ts
import { sanityFetch } from "@/sanity/lib/live";

import { PAGE_QUERY, PAGES_SLUGS_QUERY } from "@/sanity/queries/page";
import { NAVIGATION_QUERY } from "@/sanity/queries/navigation";
import { SETTINGS_QUERY } from "@/sanity/queries/settings";
import {
  POST_QUERY,
  POSTS_QUERY,
  POSTS_SLUGS_QUERY,
} from "@/sanity/queries/post";
import { PROJECT_QUERY, PROJECTS_SLUGS_QUERY } from "@/sanity/queries/project";
import { FOOTER_QUERY } from "@/sanity/queries/footer";
import { projectIndexDrawerQuery } from "@/sanity/queries/project-index-drawer";

import {
  PAGE_QUERYResult,
  PAGES_SLUGS_QUERYResult,
  POST_QUERYResult,
  POSTS_QUERYResult,
  POSTS_SLUGS_QUERYResult,
  NAVIGATION_QUERYResult,
  SETTINGS_QUERYResult,
  PROJECT_QUERYResult,
  PROJECTS_SLUGS_QUERYResult,
  // you can keep FOOTER_QUERYResult here if you want, but we won't rely on it
} from "@/sanity.types";
import type { ProjectIndexDrawerData } from "@/components/header/project-index-drawer";

export const fetchSanityPageBySlug = async ({
  slug,
}: {
  slug: string;
}): Promise<PAGE_QUERYResult> => {
  const { data } = await sanityFetch({
    query: PAGE_QUERY,
    params: { slug },
  });

  return data;
};

export const fetchSanityPagesStaticParams =
  async (): Promise<PAGES_SLUGS_QUERYResult> => {
    const { data } = await sanityFetch({
      query: PAGES_SLUGS_QUERY,
      perspective: "published",
      stega: false,
    });

    return data;
  };

export const fetchSanityPosts = async (): Promise<POSTS_QUERYResult> => {
  const { data } = await sanityFetch({
    query: POSTS_QUERY,
  });

  return data;
};

export const fetchSanityPostBySlug = async ({
  slug,
}: {
  slug: string;
}): Promise<POST_QUERYResult> => {
  const { data } = await sanityFetch({
    query: POST_QUERY,
    params: { slug },
  });

  return data;
};

export const fetchSanityPostsStaticParams =
  async (): Promise<POSTS_SLUGS_QUERYResult> => {
    const { data } = await sanityFetch({
      query: POSTS_SLUGS_QUERY,
      perspective: "published",
      stega: false,
    });

    return data;
  };

export const fetchSanityNavigation =
  async (): Promise<NAVIGATION_QUERYResult> => {
    const { data } = await sanityFetch({
      query: NAVIGATION_QUERY,
    });

    return data;
  };

export const fetchSanitySettings = async (): Promise<SETTINGS_QUERYResult> => {
  const { data } = await sanityFetch({
    query: SETTINGS_QUERY,
  });

  return data;
};

export const fetchSanityProjectBySlug = async ({
  slug,
}: {
  slug: string;
}): Promise<PROJECT_QUERYResult> => {
  const { data } = await sanityFetch({
    query: PROJECT_QUERY,
    params: { slug },
  });

  return data;
};

export const fetchSanityProjectsStaticParams =
  async (): Promise<PROJECTS_SLUGS_QUERYResult> => {
    const { data } = await sanityFetch({
      query: PROJECTS_SLUGS_QUERY,
      perspective: "published",
      stega: false,
    });

    return data;
  };

export const fetchSanityProjectIndexDrawer =
  async (): Promise<ProjectIndexDrawerData> => {
    const { data } = await sanityFetch({
      query: projectIndexDrawerQuery,
    });

    return (data ?? null) as ProjectIndexDrawerData;
  };

/**
 * Footer type that matches your GROQ query
 */
export type FooterData = {
  _id?: string;
  title?: string | null;
  copyright?: string | null;
  links?:
  | {
    _key: string;
    label?: string | null;
    href?: string | null;
  }[]
  | null;
  images?:
  | {
    _key: string;
    url?: string | null;
    alt?: string | null;
  }[]
  | null;
};

/**
 * Fetch footer document (or null if not set)
 */
export const fetchSanityFooter = async (): Promise<FooterData | null> => {
  const { data } = await sanityFetch({
    query: FOOTER_QUERY,
  });

  return (data ?? null) as FooterData | null;
};
