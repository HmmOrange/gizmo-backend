import { marked } from "marked";

export const renderMarkdown = (text) => {
    return marked(text, {
        gfm: true,
        breaks: true
    });
};
