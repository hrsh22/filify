import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000000, // Limit each IP to 10000 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000000, // Limit each IP to 5 auth requests per windowMs
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

export const deploymentLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10000, // Limit each IP to 10000 deployments per hour
    message: 'Too many deployment requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

export const githubWebhookLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10000000,
    message: 'Too many webhook requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
