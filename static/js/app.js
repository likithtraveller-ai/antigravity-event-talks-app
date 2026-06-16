// Application State
let releaseNotes = [];
let filteredNotes = [];
let selectedTextForTweet = '';
let activeTweetNote = null;

// DOM Elements
const notesContainer = document.getElementById('notes-container');
const searchInput = document.getElementById('search-input');
const searchClearBtn = document.getElementById('search-clear');
const typeFilter = document.getElementById('type-filter');
const sortSelect = document.getElementById('sort-select');
const statsCounter = document.getElementById('stats-counter');
const activeFiltersTags = document.getElementById('active-filters-tags');
const refreshBtn = document.getElementById('refresh-btn');
const refreshIcon = refreshBtn.querySelector('.icon-refresh');
const statusText = document.getElementById('status-text');
const pulseDot = document.querySelector('.pulse-dot');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const exportCsvBtn = document.getElementById('export-csv-btn');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCounter = document.getElementById('char-counter');
const charProgress = document.getElementById('char-progress');
const tweetPreviewText = document.getElementById('tweet-preview-text');
const closeModalBtn = document.getElementById('close-modal-btn');
const tweetSubmitBtn = document.getElementById('tweet-submit-btn');
const floatingTweetBtn = document.getElementById('floating-tweet-btn');

// Circular Progress Ring Settings
const RING_CIRCUMFERENCE = 88; // 2 * PI * 14

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    fetchReleaseNotes();
    setupEventListeners();
});

// Setup Events
function setupEventListeners() {
    // Refresh button
    refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));

    // Search input
    searchInput.addEventListener('input', () => {
        searchClearBtn.style.display = searchInput.value ? 'block' : 'none';
        applyFilters();
    });
    
    // Clear search
    searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchClearBtn.style.display = 'none';
        searchInput.focus();
        applyFilters();
    });

    // Filters
    typeFilter.addEventListener('change', applyFilters);
    sortSelect.addEventListener('change', applyFilters);
    
    // Theme Switcher Toggle
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }
    
    // Export CSV
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportToCSV);
    }

    // Text selection detection for floating tweet button
    document.addEventListener('selectionchange', handleTextSelection);
    floatingTweetBtn.addEventListener('click', openTweetFromSelection);

    // Modal events
    closeModalBtn.addEventListener('click', closeTweetComposer);
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) closeTweetComposer();
    });
    tweetTextarea.addEventListener('input', updateTweetPreview);
    tweetSubmitBtn.addEventListener('click', publishTweet);
}

// Fetch Data from Flask API
async function fetchReleaseNotes(forceRefresh = false) {
    // Show loading state
    setLoadingState(true);
    
    const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        releaseNotes = data.notes;
        
        // Update status indicators
        const updateTime = new Date(data.last_updated * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        statusText.textContent = `Updated at ${updateTime}`;
        pulseDot.className = 'pulse-dot';
        
        applyFilters();
    } catch (error) {
        console.error('Failed to load release notes:', error);
        statusText.textContent = 'Failed to sync feed';
        pulseDot.className = 'pulse-dot error';
        
        // Show fallback empty state if no existing notes
        if (releaseNotes.length === 0) {
            notesContainer.innerHTML = `
                <div class="error-state">
                    <h3>Failed to load release notes</h3>
                    <p>${error.message}</p>
                    <button class="btn btn-secondary" onclick="fetchReleaseNotes(true)">Try Again</button>
                </div>
            `;
        }
    } finally {
        setLoadingState(false);
    }
}

// Set Loading Spinner and Text
function setLoadingState(isLoading) {
    if (isLoading) {
        refreshBtn.disabled = true;
        refreshIcon.classList.add('spinning');
        statusText.textContent = 'Syncing feed...';
        pulseDot.className = 'pulse-dot syncing';
        
        // Show skeletons only if we don't have notes yet
        if (releaseNotes.length === 0) {
            notesContainer.innerHTML = `
                <div class="note-card shimmer"></div>
                <div class="note-card shimmer"></div>
                <div class="note-card shimmer"></div>
                <div class="note-card shimmer"></div>
            `;
        }
    } else {
        refreshBtn.disabled = false;
        refreshIcon.classList.remove('spinning');
    }
}

// Badge Helpers
function getBadgeClass(type) {
    switch (type.toLowerCase()) {
        case 'feature': return 'badge-feature';
        case 'fix': return 'badge-fix';
        case 'issue': return 'badge-issue';
        case 'deprecation': return 'badge-deprecation';
        default: return 'badge-general';
    }
}

// Apply Search, Filters, and Sorting
function applyFilters() {
    const query = searchInput.value.toLowerCase().trim();
    const selectedType = typeFilter.value;
    const sortBy = sortSelect.value;
    
    // Filter
    filteredNotes = releaseNotes.filter(note => {
        const matchesSearch = query === '' || 
            note.date.toLowerCase().includes(query) ||
            note.type.toLowerCase().includes(query) ||
            note.content_text.toLowerCase().includes(query);
            
        const matchesType = selectedType === 'all' || note.type === selectedType;
        
        return matchesSearch && matchesType;
    });
    
    // Sort
    filteredNotes.sort((a, b) => {
        const dateA = new Date(a.timestamp || a.date);
        const dateB = new Date(b.timestamp || b.date);
        return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });
    
    // Render Results
    renderCards(filteredNotes);
    updateStatsBar(query, selectedType);
}

// Render Note Cards
function renderCards(notes) {
    notesContainer.innerHTML = '';
    
    if (notes.length === 0) {
        notesContainer.innerHTML = `
            <div class="no-results-card">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <h3>No release notes match your filters</h3>
                <p>Try clearing your search query or selecting "All Updates"</p>
                <button class="btn btn-secondary btn-sm" id="reset-filters-btn">Reset Filters</button>
            </div>
        `;
        
        document.getElementById('reset-filters-btn')?.addEventListener('click', () => {
            searchInput.value = '';
            searchClearBtn.style.display = 'none';
            typeFilter.value = 'all';
            applyFilters();
        });
        return;
    }
    
    notes.forEach(note => {
        const card = document.createElement('article');
        card.className = 'note-card';
        card.setAttribute('data-id', note.id);
        
        // Mouse Move Glow Effect Coordinates
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
        
        const badgeClass = getBadgeClass(note.type);
        
        card.innerHTML = `
            <div class="card-header">
                <span class="date-badge">${note.date}</span>
                <span class="badge ${badgeClass}">${note.type}</span>
            </div>
            <div class="card-body">
                ${note.content_html}
            </div>
            <div class="card-footer">
                <a href="${note.link}" target="_blank" class="read-more-link" title="Open Google Cloud documentation">
                    <span>gcp documentation</span>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="7" y1="17" x2="17" y2="7"></line>
                        <polyline points="7 7 17 7 17 17"></polyline>
                    </svg>
                </a>
                <div class="card-actions-wrapper" style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-secondary btn-sm copy-card-btn" title="Copy release note text to clipboard">
                        <svg class="icon-copy" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>Copy</span>
                    </button>
                    <button class="btn btn-secondary btn-sm tweet-card-btn" title="Tweet this specific update">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                        </svg>
                        <span>Tweet</span>
                    </button>
                </div>
            </div>
        `;
        
        // Event for card Copy Button
        card.querySelector('.copy-card-btn').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const originalText = btn.innerHTML;
            try {
                await navigator.clipboard.writeText(note.content_text);
                btn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>Copied!</span>
                `;
                btn.classList.add('btn-copied');
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.classList.remove('btn-copied');
                }, 2000);
            } catch (err) {
                console.error('Failed to copy text: ', err);
            }
        });
        
        // Event for card Tweet Button
        card.querySelector('.tweet-card-btn').addEventListener('click', () => {
            openTweetComposer(note);
        });
        
        notesContainer.appendChild(card);
    });
}

// Update Stats counter & Tags
function updateStatsBar(query, type) {
    const count = filteredNotes.length;
    statsCounter.textContent = `Showing ${count} update${count !== 1 ? 's' : ''}`;
    
    activeFiltersTags.innerHTML = '';
    
    if (query) {
        createFilterTag(`Search: "${query}"`, () => {
            searchInput.value = '';
            searchClearBtn.style.display = 'none';
            applyFilters();
        });
    }
    
    if (type !== 'all') {
        createFilterTag(`Type: ${type}`, () => {
            typeFilter.value = 'all';
            applyFilters();
        });
    }
}

function createFilterTag(text, onRemove) {
    const tag = document.createElement('span');
    tag.className = 'filter-tag';
    tag.innerHTML = `
        <span>${text}</span>
        <span class="filter-tag-close">&times;</span>
    `;
    tag.querySelector('.filter-tag-close').addEventListener('click', onRemove);
    activeFiltersTags.appendChild(tag);
}

// Text Selection Handling (Floating Tweet Button)
function handleTextSelection() {
    const selection = window.getSelection();
    const selectedStr = selection.toString().trim();
    
    if (selectedStr.length < 5) {
        floatingTweetBtn.style.display = 'none';
        return;
    }
    
    // Check if the selection is inside a note-card body
    let parent = selection.anchorNode.parentElement;
    let inCardBody = false;
    let cardElement = null;
    
    while (parent && parent !== document.body) {
        if (parent.classList.contains('card-body')) {
            inCardBody = true;
        }
        if (parent.classList.contains('note-card')) {
            cardElement = parent;
        }
        parent = parent.parentElement;
    }
    
    if (!inCardBody || !cardElement) {
        floatingTweetBtn.style.display = 'none';
        return;
    }
    
    // Store selected string and matching card note reference
    selectedTextForTweet = selectedStr;
    const noteId = cardElement.getAttribute('data-id');
    activeTweetNote = releaseNotes.find(n => n.id === noteId);
    
    // Position floating button above selection
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    floatingTweetBtn.style.top = `${rect.top + window.scrollY - 48}px`;
    floatingTweetBtn.style.left = `${rect.left + window.scrollX + (rect.width / 2) - 80}px`;
    floatingTweetBtn.style.display = 'flex';
}

// Tweet Selected Highlighted Text
function openTweetFromSelection(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!selectedTextForTweet || !activeTweetNote) return;
    
    // Draft tweet with selected text snippet
    const date = activeTweetNote.date;
    const type = activeTweetNote.type;
    const link = activeTweetNote.link;
    
    // Build draft text
    // E.g., "📢 BigQuery Release (June 15): "selected text..." \n\nDetails: [link]"
    const cleanDate = date.replace(/,\s*\d{4}/, ''); // simplify "June 15, 2026" to "June 15"
    const prefix = `📢 BigQuery ${type} (${cleanDate}): "`;
    const suffix = `" \n\nDetails: ${link}`;
    
    // Figure out how much space we have for the snippet
    // Max characters = 280
    const maxSnippetLen = 280 - prefix.length - suffix.length - 3; // safety padding
    let snippet = selectedTextForTweet;
    if (snippet.length > maxSnippetLen) {
        snippet = snippet.substring(0, maxSnippetLen - 3) + '...';
    }
    
    const tweetText = `${prefix}${snippet}${suffix}`;
    
    // Open composer
    openComposerModal(tweetText, activeTweetNote);
    
    // Clear selection UI
    window.getSelection().removeAllRanges();
    floatingTweetBtn.style.display = 'none';
}

// Tweet Whole Update Card
function openTweetComposer(note) {
    selectedTextForTweet = '';
    activeTweetNote = note;
    
    const date = note.date;
    const type = note.type;
    const text = note.content_text;
    const link = note.link;
    
    const cleanDate = date.replace(/,\s*\d{4}/, ''); // simplify "June 15, 2026" to "June 15"
    const prefix = `📢 BigQuery ${type} (${cleanDate}): `;
    const suffix = ` \n\nDetails: ${link}`;
    
    const maxTextLen = 280 - prefix.length - suffix.length - 5;
    let snippet = text;
    if (snippet.length > maxTextLen) {
        snippet = snippet.substring(0, maxTextLen - 3) + '...';
    }
    
    const tweetText = `${prefix}${snippet}${suffix}`;
    openComposerModal(tweetText, note);
}

// Open Composer UI
function openComposerModal(text, note) {
    tweetTextarea.value = text;
    tweetModal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Lock background scroll
    
    // Set link card details in modal preview
    const linkCard = tweetModal.querySelector('.tweet-link-card');
    linkCard.setAttribute('onclick', `window.open('${note.link}', '_blank')`);
    linkCard.querySelector('.link-card-title').textContent = `BigQuery Release Notes (${note.date})`;
    
    updateTweetPreview();
    tweetTextarea.focus();
    // Set cursor at the beginning or highlight to edit
    tweetTextarea.setSelectionRange(0, 0);
}

// Close Composer UI
function closeTweetComposer() {
    tweetModal.style.display = 'none';
    document.body.style.overflow = ''; // Restore scroll
    activeTweetNote = null;
}

// Update Tweet Preview & Progress indicator
function updateTweetPreview() {
    const text = tweetTextarea.value;
    const len = text.length;
    
    // Update counter
    const remaining = 280 - len;
    charCounter.textContent = remaining;
    
    // Manage colors & button state
    if (remaining < 0) {
        charCounter.classList.add('danger');
        tweetSubmitBtn.disabled = true;
    } else {
        charCounter.classList.remove('danger');
        tweetSubmitBtn.disabled = false;
    }
    
    // Update circular progress ring
    const percent = Math.min(len / 280, 1);
    const offset = RING_CIRCUMFERENCE - (percent * RING_CIRCUMFERENCE);
    charProgress.style.strokeDashoffset = offset;
    
    // Set colors of progress ring based on remaining space
    charProgress.classList.remove('warning', 'danger');
    if (remaining <= 0) {
        charProgress.classList.add('danger');
    } else if (remaining <= 30) {
        charProgress.classList.add('warning');
    }
    
    // Update Mockup HTML Preview
    // Highlight links, hashtags, mentions
    let formattedText = escapeHtml(text);
    
    // URLs
    formattedText = formattedText.replace(
        /(https?:\/\/[^\s]+)/g, 
        '<a href="$1" target="_blank">$1</a>'
    );
    // Hashtags
    formattedText = formattedText.replace(
        /#(\w+)/g, 
        '<a href="https://twitter.com/hashtag/$1" target="_blank">#$1</a>'
    );
    // Mentions
    formattedText = formattedText.replace(
        /@(\w+)/g, 
        '<a href="https://twitter.com/$1" target="_blank">@$1</a>'
    );
    
    tweetPreviewText.innerHTML = formattedText || '<span style="color:#71767b">Draft is empty...</span>';
}

// HTML escape helper
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// Publish Tweet
function publishTweet() {
    const text = tweetTextarea.value;
    if (text.length > 280) return;
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank');
    closeTweetComposer();
}

// Theme Toggle Functionality
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    if (!themeToggleBtn) return;
    const sunIcon = themeToggleBtn.querySelector('.icon-sun');
    const moonIcon = themeToggleBtn.querySelector('.icon-moon');
    
    if (theme === 'light') {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
    } else {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

// Export to CSV Functionality
function exportToCSV() {
    if (filteredNotes.length === 0) {
        alert('No release notes to export.');
        return;
    }
    
    const headers = ['Date', 'Type', 'Link', 'Content'];
    
    const rows = filteredNotes.map(note => {
        const date = note.date || '';
        const type = note.type || '';
        const link = note.link || '';
        const content = (note.content_text || '').replace(/"/g, '""');
        return `"${date}","${type}","${link}","${content}"`;
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `bigquery_release_notes_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
