"""A small sample catalog of learning modules used by the demo and tests."""

from __future__ import annotations

from .recommender import Item

RAW: tuple[tuple[str, str, str, tuple[str, ...], str], ...] = (
    # id, title, category, tags, description
    ("ml-101", "Intro to Machine Learning", "machine-learning",
     ("supervised", "regression", "classification"),
     "Core ideas behind supervised learning: features, labels, training and test splits, "
     "overfitting, and how a model generalizes to data it has never seen."),
    ("ml-vectors", "Text Vectorization with TF-IDF", "machine-learning",
     ("nlp", "tfidf", "features"),
     "Turn documents into numeric vectors: term frequency, inverse document frequency, "
     "sublinear scaling, and L2 normalization for cosine similarity."),
    ("ml-recsys", "Recommendation Systems", "machine-learning",
     ("recommenders", "similarity", "content-based"),
     "Content-based and collaborative filtering, cold-start problems, and building a "
     "user taste profile from items the user already liked."),
    ("ml-eval", "Evaluating Ranked Results", "machine-learning",
     ("metrics", "evaluation", "ranking"),
     "Precision and recall at k, mean reciprocal rank, average precision, and NDCG — "
     "how to tell whether a ranking model is actually any good."),
    ("ml-nlp", "Natural Language Processing Basics", "machine-learning",
     ("nlp", "tokenization", "embeddings"),
     "Tokenization, stopwords, stemming, and the jump from sparse bag-of-words "
     "representations to dense learned embeddings."),
    ("ml-cluster", "Clustering and Unsupervised Learning", "machine-learning",
     ("kmeans", "unsupervised", "similarity"),
     "Grouping unlabeled data with k-means and hierarchical clustering, choosing k, "
     "and measuring cluster quality."),
    ("ml-nn", "Neural Networks from Scratch", "machine-learning",
     ("deep-learning", "backpropagation", "python"),
     "Build a small feedforward network by hand: forward pass, loss functions, "
     "backpropagation, and gradient descent."),

    ("web-html", "Semantic HTML and Document Structure", "front-end",
     ("html", "semantics", "accessibility"),
     "Headings, landmarks, lists, and forms that describe meaning rather than "
     "appearance, giving assistive technology something real to work with."),
    ("web-css", "Modern CSS Layout", "front-end",
     ("css", "flexbox", "grid", "responsive"),
     "Flexbox and grid, custom properties, container queries, and building "
     "responsive layouts without a framework."),
    ("web-js", "JavaScript for the DOM", "front-end",
     ("javascript", "dom", "events"),
     "Selecting elements, handling events, delegation, and updating the DOM "
     "efficiently in the browser."),
    ("web-a11y", "Web Accessibility in Practice", "front-end",
     ("accessibility", "aria", "keyboard"),
     "Keyboard navigation, focus management, ARIA roles and states, color contrast, "
     "and testing a page the way real assistive technology sees it."),
    ("web-react", "Component-Based UI with React", "front-end",
     ("react", "components", "state"),
     "Thinking in components: props, state, effects, lists and keys, and lifting "
     "state up to share it between siblings."),
    ("web-perf", "Front-End Performance", "front-end",
     ("performance", "loading", "rendering"),
     "Critical rendering path, lazy loading, bundle size, layout thrashing, and "
     "measuring what users actually experience."),
    ("web-charts", "Data Visualization with SVG", "front-end",
     ("svg", "charts", "dataviz"),
     "Drawing bars, arcs, and axes directly in SVG — coordinate math, scales, "
     "and making charts readable and accessible."),

    ("api-rest", "Designing REST APIs", "back-end",
     ("rest", "http", "api-design"),
     "Resources, verbs, status codes, pagination, and versioning — designing an "
     "interface that stays predictable as it grows."),
    ("api-auth", "Authentication and Sessions", "back-end",
     ("jwt", "oauth", "sessions", "security"),
     "Password hashing, session cookies versus JSON Web Tokens, refresh flows, "
     "and the tradeoffs between them."),
    ("api-sql", "Relational Database Design", "back-end",
     ("sql", "schema", "normalization"),
     "Tables, keys, relationships, normalization, and the indexes that keep queries "
     "fast as data grows."),
    ("api-query", "Query Optimization", "back-end",
     ("sql", "indexes", "performance"),
     "Reading query plans, choosing indexes, avoiding N+1 access patterns, and "
     "measuring before optimizing."),
    ("api-async", "Concurrency and Async Programming", "back-end",
     ("async", "concurrency", "python"),
     "Event loops, coroutines, thread pools, and when concurrency actually makes "
     "a service faster instead of just more complicated."),
    ("api-cache", "Caching Strategies", "back-end",
     ("caching", "redis", "performance"),
     "Cache keys, expiry, invalidation, and rate-limit-friendly caching for "
     "third-party APIs."),
    ("api-test", "Testing Web Services", "back-end",
     ("testing", "pytest", "integration"),
     "Unit versus integration tests, test databases, fixtures, and writing tests "
     "that fail for the right reasons."),

    ("sec-owasp", "OWASP Top Ten", "security",
     ("owasp", "vulnerabilities", "web-security"),
     "The most common classes of web vulnerability — injection, broken access "
     "control, misconfiguration — and the defenses for each."),
    ("sec-headers", "HTTP Security Headers", "security",
     ("headers", "csp", "hsts", "web-security"),
     "Content Security Policy, HSTS, frame options, and referrer policy: what each "
     "header defends against and how weak values undermine it."),
    ("sec-crypto", "Applied Cryptography Basics", "security",
     ("hashing", "encryption", "passwords"),
     "Hashing versus encryption, salts, key derivation functions, and why fast "
     "hashes are the wrong tool for passwords."),
    ("sec-secrets", "Secrets Management", "security",
     ("secrets", "credentials", "scanning"),
     "Keeping keys out of source control, rotating credentials, and scanning "
     "repositories for tokens that leaked anyway."),
    ("sec-authz", "Access Control and Authorization", "security",
     ("authorization", "rbac", "security"),
     "Roles versus permissions, enforcing ownership on every query, and the "
     "insecure-direct-object-reference bugs that follow when you don't."),
    ("sec-threat", "Threat Modeling", "security",
     ("threat-modeling", "risk", "design"),
     "Mapping trust boundaries, enumerating what an attacker would try, and "
     "prioritizing defenses by realistic risk."),

    ("eng-git", "Version Control with Git", "software-engineering",
     ("git", "branching", "collaboration"),
     "Branches, merges, rebases, and writing a history that a reviewer can "
     "actually follow."),
    ("eng-review", "Code Review and Readability", "software-engineering",
     ("code-review", "readability", "collaboration"),
     "Naming, small functions, and reviewing for correctness and clarity instead "
     "of personal style preferences."),
    ("eng-ci", "Continuous Integration Pipelines", "software-engineering",
     ("ci", "automation", "testing"),
     "Running tests, linting, and builds automatically on every push so problems "
     "surface before they reach a teammate."),
    ("eng-debug", "Debugging and Profiling", "software-engineering",
     ("debugging", "profiling", "tooling"),
     "Reproducing a bug reliably, bisecting to the change that caused it, and "
     "profiling before guessing at performance fixes."),
    ("eng-arch", "Software Design Patterns", "software-engineering",
     ("patterns", "architecture", "oop"),
     "Layering, dependency injection, MVC, and the patterns worth reaching for "
     "when a codebase starts to sprawl."),
    ("eng-docs", "Technical Writing for Engineers", "software-engineering",
     ("documentation", "writing", "communication"),
     "READMEs, design docs, and commit messages that explain the why so the next "
     "reader does not have to reverse-engineer it."),
)


def load_catalog() -> list[Item]:
    """Return the sample catalog as :class:`Item` objects."""
    return [
        Item(id=item_id, title=title, category=category, tags=tags, description=description)
        for item_id, title, category, tags, description in RAW
    ]
