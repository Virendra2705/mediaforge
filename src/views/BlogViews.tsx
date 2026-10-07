import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Calendar,
  Clock,
  User,
  Tag,
  ArrowLeft,
  Share2,
  Bookmark,
  Check,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AppRoute } from '../types';
import { AdContainer } from '../components/ads/AdContainer';

interface BlogPostItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  author: string;
  publishedAt: string;
  readTime: string;
  tags: string[];
  featuredImage: string;
}

export const BlogListView: React.FC = () => {
  const { setRoute } = useApp();
  const [posts, setPosts] = useState<BlogPostItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  useEffect(() => {
    fetch('/api/blog')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setPosts(data.data);
        }
      })
      .catch(() => {});
  }, []);

  const categories = ['All', 'Audio Engineering', 'Video Technology', 'Compliance & Legal'];

  const filteredPosts =
    selectedCategory === 'All'
      ? posts
      : posts.filter(p => p.category === selectedCategory);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
          VideoFetch Engineering & Knowledge Base
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Articles, Guides & Tech Specs
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
          In-depth technical guides on audio bitrates, video compression algorithms, Fair Use, and media transcoding pipelines.
        </p>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Blog Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPosts.map(post => (
          <article
            key={post.id}
            onClick={() => setRoute(`/blog/${post.slug}` as AppRoute)}
            className="group cursor-pointer rounded-2xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-sm hover:shadow-xl hover:border-indigo-400 dark:hover:border-indigo-600 transition-all flex flex-col justify-between vf-card-hover"
          >
            <div>
              {/* Featured Image */}
              <div className="aspect-video w-full overflow-hidden bg-slate-950">
                <img
                  src={post.featuredImage}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* Body */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {post.category}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {post.readTime}
                  </span>
                </div>

                <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {post.title}
                </h3>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                  {post.excerpt}
                </p>
              </div>
            </div>

            {/* Footer / Author */}
            <div className="p-5 pt-0 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 mt-4 pt-3 text-xs text-slate-500">
              <span className="truncate">{post.author}</span>
              <span className="font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Read Article <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export const BlogPostView: React.FC<{ slug: string }> = ({ slug }) => {
  const { setRoute, addToast } = useApp();
  const [post, setPost] = useState<BlogPostItem | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/blog/${slug}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setPost(data.data);
        }
      })
      .catch(() => {});
  }, [slug]);

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Article Not Found</h2>
        <p className="text-sm text-slate-500">The requested guide could not be located.</p>
        <button
          onClick={() => setRoute('/blog')}
          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
        >
          Return to Articles
        </button>
      </div>
    );
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    addToast('success', 'Link Copied', 'Article URL copied to clipboard.');
    setTimeout(() => setIsCopied(false), 2500);
  };

  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <button onClick={() => setRoute('/')} className="hover:text-slate-800 dark:hover:text-slate-200">
          Home
        </button>
        <ChevronRight className="w-3 h-3" />
        <button onClick={() => setRoute('/blog')} className="hover:text-slate-800 dark:hover:text-slate-200">
          Blog
        </button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-xs">{post.title}</span>
      </div>

      {/* Article Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            {post.category}
          </span>
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {post.readTime}
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white leading-[1.2]">
          {post.title}
        </h1>

        {/* Author / Metadata Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200">
              {post.author.charAt(0)}
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                {post.author}
              </div>
              <div className="text-xs text-slate-500">
                Published {new Date(post.publishedAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'Copied' : 'Share'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Featured Banner */}
      <div className="w-full aspect-video rounded-2xl overflow-hidden bg-slate-950 shadow-xl">
        <img src={post.featuredImage} alt={post.title} className="w-full h-full object-cover" />
      </div>

      {/* Article Content Body */}
      <div className="prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 leading-relaxed text-sm sm:text-base space-y-4">
        {post.content.split('\n\n').map((para, i) => {
          if (para.startsWith('### ')) {
            return (
              <h3 key={i} className="text-xl font-bold text-slate-900 dark:text-white pt-4">
                {para.replace('### ', '')}
              </h3>
            );
          }
          if (para.startsWith('1. ') || para.startsWith('- ')) {
            return (
              <div key={i} className="pl-4 border-l-2 border-blue-500 text-slate-700 dark:text-slate-300">
                {para}
              </div>
            );
          }
          return (
            <p key={i} className="text-slate-700 dark:text-slate-300 leading-relaxed">
              {para}
            </p>
          );
        })}
      </div>

      {/* Tags */}
      <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-slate-500">Tags:</span>
        {post.tags.map(t => (
          <span
            key={t}
            className="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
          >
            #{t}
          </span>
        ))}
      </div>

      {/* Back Button CTA */}
      <div className="pt-8 text-center">
        <button
          onClick={() => setRoute('/blog')}
          className="px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 inline-flex items-center gap-2 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Articles</span>
        </button>
      </div>
    </article>
  );
};
