const API_KEY = 'AIzaSyDjo7wOP3QOfdXAcAmf1FRuJDROLj5ejPo';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Advanced configuration
const APP_CONFIG = {
    version: '2.0.0',
    supportedFileTypes: {
        documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff', 'image/bmp'],
        text: ['text/plain']
    },
    aiModels: {
        default: 'advanced-flash',
        advanced: 'advanced-pro',
        vision: 'advanced-vision'
    },
    maxFileSize: 25 * 1024 * 1024, // 25MB
    maxImageResolution: 4096, // Maximum resolution for image processing
    ocrLanguages: ['eng', 'fra', 'deu', 'spa', 'ita', 'por', 'rus', 'chi_sim', 'jpn', 'kor']
};

// Global variables to store document state
let fileName = '';
let fileType = '';
let extractedText = '';
    let processingComplete = false;
let currentFileData = null;
let currentFile = null;
let currentAnalysisOption = 'summarize';
let isCustomPrompt = false;
let darkMode = false;

document.addEventListener('DOMContentLoaded', () => {
    console.log('Document Analyzer initialized');
    initializeApp();
});

// Update history display in sidebar
function updateHistoryDisplay() {
    const savedAnalyses = document.getElementById('savedAnalyses');
    if (!savedAnalyses) return;
    
    // Load history from localStorage
    const analysisHistory = JSON.parse(localStorage.getItem('analysisHistory')) || [];
    
    // Clear existing history
    savedAnalyses.innerHTML = '';
    
    // Check if history is empty
    if (analysisHistory.length === 0) {
        savedAnalyses.innerHTML = '<p class="no-history">No saved analyses yet</p>';
        return;
    }
    
    // Add each history item
    analysisHistory.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        // Create a safe snippet by checking if results exists first
        const resultsSnippet = item.results && typeof item.results === 'string' 
            ? item.results.substring(0, 100) + '...' 
            : 'No content available';
        
        historyItem.innerHTML = `
            <div class="history-item-header">
                <h4>${item.documentName || 'Unnamed Document'}</h4>
                <span class="history-timestamp">${formatDate(new Date(item.timestamp))}</span>
            </div>
            <div class="history-item-content">
                <span class="analysis-type">${item.analysisType || 'Analysis'}</span>
                <div class="history-snippet">${resultsSnippet}</div>
            </div>
            <div class="history-item-actions">
                <button class="history-action-btn" data-action="view" data-history-id="${item.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>
                <button class="history-action-btn" data-action="delete" data-history-id="${item.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `;
        
        savedAnalyses.appendChild(historyItem);
    });
    
    // Add event listeners to history action buttons
    const actionButtons = savedAnalyses.querySelectorAll('.history-action-btn');
    actionButtons.forEach(btn => {
        btn.addEventListener('click', handleHistoryAction);
    });
}

// Handle history item actions (view, delete)
function handleHistoryAction(e) {
    const action = e.currentTarget.getAttribute('data-action');
    const historyId = e.currentTarget.getAttribute('data-history-id');
    
    // Load history from localStorage
    const analysisHistory = JSON.parse(localStorage.getItem('analysisHistory')) || [];
    
    // Find the specific history item
    const historyItem = analysisHistory.find(item => item.id === historyId);
    
    if (!historyItem) {
        console.error('History item not found:', historyId);
        return;
    }
    
    if (action === 'view') {
        // Display the results in the results section
    const resultsContent = document.getElementById('resultsContent');
        const resultsSection = document.querySelector('.results-section');
        
        if (resultsContent && resultsSection) {
            resultsContent.innerHTML = formatMarkdown(historyItem.results);
            resultsSection.style.display = 'block';
            resultsSection.scrollIntoView({ behavior: 'smooth' });
            
            // Store as current results
            window.analysisResults = historyItem.results;
            
            showToast(`Loaded analysis for ${historyItem.documentName}`, 'info');
        }
    } else if (action === 'delete') {
        // Remove from history
        const updatedHistory = analysisHistory.filter(item => item.id !== historyId);
        localStorage.setItem('analysisHistory', JSON.stringify(updatedHistory));
        
        // Update the display
        updateHistoryDisplay();
        
        showToast('Analysis removed from history', 'success');
    }
}

// Add a function to initialize the advanced features tab
function initAdvancedFeatures() {
    const advancedToggle = document.getElementById('advancedToggle');
    const advancedContent = document.querySelector('.advanced-content');
    const advancedFeatureButtons = document.querySelectorAll('.feature-btn');
    
    if (advancedToggle && advancedContent) {
        advancedToggle.addEventListener('click', () => {
            const isVisible = advancedContent.style.display !== 'none';
            advancedContent.style.display = isVisible ? 'none' : 'block';
            advancedToggle.classList.toggle('active', !isVisible);
            
            if (!isVisible) {
                showToast('Advanced features are available', 'info');
            }
        });
    }
    
    // Add "under construction" message to all advanced feature buttons
    if (advancedFeatureButtons) {
        advancedFeatureButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const featureName = button.textContent.trim();
                showToast(`${featureName} feature is still under construction. Coming soon!`, 'info');
            });
        });
    }
}

// Initialize the application
function initializeApp() {
    console.log('Initializing Document Analyzer application...');
    
    try {
        // Set default dark mode based on user's preference
        const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDarkMode) {
            document.body.classList.add('dark-mode');
        }
        
        // Initialize core features
        loadSettings();
        initConfirmationDialog();
        initKeyboardShortcuts();
        initFileInputHandling();
        initSampleFiles();
        initializeAnalysisOptions();
        initViewSampleButtons();
        initPreviewControls();
        updateDocumentList();
        updateHistoryDisplay();
        initAdvancedFeatures();
        setupFileUploadEvents();
        setupUIElements();
        setupValidation();
        initQuickActions();
        setupResultActionButtons();
        initializeDragAndDrop();
        initTextToSpeechAndTranslation();
        
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Error initializing application:', error);
        showToast('Error initializing application. Please refresh the page.', 'error');
    }
}

// Prevent default behaviors for drag and drop events
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

// Touch event handlers
function handleTouchStart(e) {
    preventDefaults(e);
}

function handleTouchEnd(e) {
    preventDefaults(e);
}

// File handling functions
function initializeDragAndDrop() {
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('fileInput');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    dropArea.addEventListener('drop', handleDrop, false);
    
    // Add touch support
    dropArea.addEventListener('touchstart', handleTouchStart, false);
    dropArea.addEventListener('touchend', handleTouchEnd, false);
    
    function highlight() {
        dropArea.classList.add('drag-over');
    }
    
    function unhighlight() {
        dropArea.classList.remove('drag-over');
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
        handleFiles(files);
        }
    }
}

function initFileInputHandling() {
    // This function is not needed anymore as setupFileUploadEvents handles both
    console.log('File input handling initialized through setupFileUploadEvents');
}

function initSampleFiles() {
    const sampleFiles = document.querySelectorAll('.sample-file');
    
    sampleFiles.forEach(sample => {
        sample.addEventListener('click', () => {
            const fileType = sample.getAttribute('data-file');
            loadSampleFile(fileType);
        });
    });
}

function loadSampleFile(fileType) {
    showToast('Loading sample file...', 'info');
    
    let fileUrl, fileName;
    
    switch(fileType) {
        case 'sample-pdf':
            fileUrl = 'samples/sample.pdf';
            fileName = 'Sample Report.pdf';
            break;
        case 'sample-image':
            fileUrl = 'samples/sample.png';
            fileName = 'Sample Image.png';
            break;
        default:
            showToast('Unknown sample file type', 'error');
            return;
    }
    
    console.log(`Attempting to load sample file: ${fileUrl}`);
    
    // Fetch the sample file
    fetch(fileUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Network response was not ok (${response.status} ${response.statusText})`);
            }
            return response.blob();
        })
        .then(blob => {
            // Create a File object from the blob
            const file = new File([blob], fileName, { type: blob.type });
            console.log('Sample file loaded successfully:', file);
            
            // Process the file as if it was uploaded
            handleFiles([file]);
        })
        .catch(error => {
            console.error('Error loading sample file:', error);
            // Less alarming error message
            showToast(`Sample file is loading, please try again in a moment.`, 'info');
        });
}

function initPreviewControls() {
    const closePreviewBtn = document.getElementById('closePreview');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    
    if (closePreviewBtn) {
        closePreviewBtn.addEventListener('click', () => {
            document.getElementById('filePreview').style.display = 'none';
        });
    }
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (window.pdfDocument && window.currentPdfPage > 1) {
                window.currentPdfPage--;
                renderPdfPage(window.pdfDocument, window.currentPdfPage);
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            if (window.pdfDocument && window.currentPdfPage < window.pdfDocument.numPages) {
                window.currentPdfPage++;
                renderPdfPage(window.pdfDocument, window.currentPdfPage);
            }
        });
    }
}

// Render a specific PDF page
function renderPdfPage(pdf, pageNum) {
    pdf.getPage(pageNum).then(function(page) {
        const canvas = document.getElementById('pdfCanvas');
        const context = canvas.getContext('2d');
        
        // Use a fixed scale of 1.5 since settings are removed
        const scale = 1.5;
        
        // Calculate desired canvas dimensions
        const viewport = page.getViewport({ scale: scale });
        
        // Set canvas dimensions
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Prepare render context
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        // Update page navigation UI
        updatePageControls(pageNum, pdf.numPages);
        
        // Render the page
        page.render(renderContext).promise.then(function() {
            // Update current page tracking
            window.currentPdfPage = pageNum;
            
            console.log(`Rendered page ${pageNum} at scale ${scale}`);
        }).catch(function(error) {
            console.error('Error rendering PDF page:', error);
            showToast('Error rendering PDF page', 'error');
        });
    }).catch(function(error) {
        console.error('Error getting PDF page:', error);
        showToast('Error loading PDF page', 'error');
    });
}

// Update page navigation controls
function updatePageControls(currentPage, totalPages) {
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');
    
    if (prevPageBtn) {
        prevPageBtn.disabled = currentPage <= 1;
    }
    
    if (nextPageBtn) {
        nextPageBtn.disabled = currentPage >= totalPages;
    }
    
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    }
}

function initializeAnalysisOptions() {
    const optionBtns = document.querySelectorAll('.option-btn');
    const customPromptContainer = document.querySelector('.custom-prompt-container');
    const startAnalysisBtn = document.getElementById('startAnalysisBtn');
    
    // Initialize analysis options
    optionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const option = btn.getAttribute('data-option');
            
            // Remove active class from all buttons
            optionBtns.forEach(b => b.classList.remove('active'));
            
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Show/hide custom prompt container
            if (option === 'custom') {
                customPromptContainer.style.display = 'block';
                customPromptContainer.classList.add('pulse-animation');
                setTimeout(() => {
                    customPromptContainer.classList.remove('pulse-animation');
                }, 1500);
            } else {
                customPromptContainer.style.display = 'none';
            }
            });
    });

    // Set default option
    document.querySelector('[data-option="summarize"]').classList.add('active');
    
    // Add event listener to start analysis button
    if (startAnalysisBtn) {
        startAnalysisBtn.addEventListener('click', analyzeContent);
    }
}

// Updated function to handle files with improved UX
    async function handleFiles(files) {
    if (!files || files.length === 0) {
        showToast('No files selected', 'error');
        return;
    }
        
    try {
        // Only process the first file for now
        const file = files[0];
        currentFile = file; // Set the current file globally
        
        console.log('Processing file:', {
            name: file.name,
            type: file.type,
            size: file.size
        });
        
        showToast(`Processing ${file.name}...`, 'info');
        
        // Update UI to reflect file is being processed
        updateProgress(0, 'Starting file processing...');
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.style.display = 'block';
        }
        
        let processedData;
        
        // Process different file types
        if (file.type.includes('pdf')) {
            processedData = await processPDF(file);
            
            // Check if processing was successful
            if (!processedData.success) {
                throw new Error(processedData.error || 'Failed to process PDF');
            }
            
        } else if (file.type.includes('image')) {
            processedData = await processImage(file);
        } else if (file.type.includes('msword') || file.type.includes('officedocument.wordprocessingml')) {
            processedData = await processWordDocument(file);
        } else if (file.type.includes('text')) {
            processedData = await processTextFile(file);
        } else {
            throw new Error('Unsupported file type: ' + file.type);
        }
        
        console.log('File processed successfully:', {
            fileName: file.name,
            hasText: Boolean(processedData.text),
            textLength: processedData.text ? processedData.text.length : 0
        });
        
        // Check if we have text content
        if (!processedData.text || processedData.text.trim() === '') {
            console.warn('No text content extracted from file');
            showToast('Warning: No text content could be extracted from this file', 'warning');
        }
        
        // Store extracted text and file data globally
        window.extractedText = processedData.text || '';
        
        // Display file preview
        displayFilePreview(file);
        
        // Add file to document collection if not already present
        if (!window.documentCollection) {
            window.documentCollection = [];
        }
        
        // Check if document already exists in collection
        const existingDocIndex = window.documentCollection.findIndex(doc => 
            doc.name === file.name && doc.type === file.type
        );
        
        if (existingDocIndex === -1) {
            // Add to document collection
            window.documentCollection.push({
                id: `doc-${Date.now()}`,
                name: file.name,
                type: file.type,
                size: file.size,
                lastModified: file.lastModified,
                text: processedData.text || '',
                pageCount: processedData.pageCount || 1,
                metadata: processedData.metadata || {}
            });
            
            // Update document list in sidebar
            updateDocumentList();
            
            showToast(`${file.name} added to your document collection`, 'success');
        } else {
            // Update existing document
            window.documentCollection[existingDocIndex] = {
                ...window.documentCollection[existingDocIndex],
                text: processedData.text || '',
                lastModified: file.lastModified,
                pageCount: processedData.pageCount || 1,
                metadata: processedData.metadata || {}
            };
            
            showToast(`${file.name} updated in your document collection`, 'info');
        }
        
        // Hide progress bar
        if (progressBar) {
            progressBar.style.display = 'none';
        }
        
        // Scroll to analysis options on mobile
        if (window.innerWidth <= 768) {
            document.querySelector('.analysis-options').scrollIntoView({ behavior: 'smooth' });
        }
        
        return processedData;
        
    } catch (error) {
        console.error('Error processing file:', error);
        showToast(`Error processing file: ${error.message}`, 'error');
        
        // Hide progress
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.style.display = 'none';
        }
        
        throw error;
    }
}

// Get prompt for specific analysis option
function getPromptForOption(option) {
    switch(option) {
        case 'summarize':
            return "Summarize the key points and main ideas of the document in a concise way. Highlight the most important information and create a structured summary.";
        
        case 'extract-key-points':
            return "Extract the most significant points, facts, and insights from the document. Present these as a bullet-point list of key takeaways.";
        
        case 'sentiment':
            return "Analyze the overall sentiment and emotional tone of this document. Identify positive, negative, or neutral elements, and explain the factors contributing to this sentiment assessment.";
        
        case 'questions':
            return "Generate 5-10 meaningful questions and answers based on the document content. Focus on questions that test understanding of the main concepts and important details.";
        
        case 'entities':
            return "Identify and categorize all significant entities mentioned in the document, such as people, organizations, locations, dates, and key concepts. Organize these into clear categories.";
        
        case 'custom':
            const customPrompt = document.getElementById('customPrompt').value.trim();
            return customPrompt || "Please provide your custom analysis instructions.";
        
        default:
            return "Analyze this document and provide a comprehensive overview of its content, structure, and key points.";
    }
}

// Function to enhance the prompt with context
function enhancePromptWithContext(prompt) {
    // Add document metadata if available
    let enhancedPrompt = prompt;
    
    if (currentFile) {
        enhancedPrompt = `Document Name: ${currentFile.name}\nDocument Type: ${currentFile.type}\n\n${enhancedPrompt}`;
    }
    
    // Add additional instructions for thoroughness
    enhancedPrompt += "\n\nPlease be thorough in your analysis while maintaining clarity and conciseness.";
    
    return enhancedPrompt;
}

async function analyzeContent() {
    console.log('Starting analysis process...');
    
    // Check if there's a file to analyze
    if (!currentFile) {
        console.error('No file available for analysis');
        showToast('Please upload a file first', 'error');
            return;
        }
        
    console.log('Analyzing file:', currentFile.name);
    
    // Get the results elements
    const resultsSection = document.querySelector('.results-section');
    const resultsContent = document.getElementById('resultsContent');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const progressBar = document.getElementById('progressBar');
    
    try {
        // Show loading indicators
        if (loadingIndicator) {
            loadingIndicator.style.display = 'flex';
            const loadingMessage = loadingIndicator.querySelector('p');
            if (loadingMessage) {
                loadingMessage.textContent = 'Analyzing document...';
            }
        }
        
        if (progressBar) {
            progressBar.style.display = 'block';
            updateProgress(0, 'Starting analysis...');
        }
        
        // Get the selected analysis type
        const analysisType = document.querySelector('input[name="analysisType"]:checked').value;
        console.log('Analysis type:', analysisType);
        
        // Get the selected analysis option
        const analysisOption = document.querySelector('.option-btn.active');
        if (!analysisOption) {
            console.error('No analysis option selected');
            showToast('Please select an analysis option', 'error');
            return;
        }
        
        // Store the current analysis option
        currentAnalysisOption = analysisOption.getAttribute('data-option');
        console.log('Selected analysis option:', currentAnalysisOption);
        
        // Determine the prompt
        let prompt;
        
        // Handle custom prompt
        if (currentAnalysisOption === 'custom') {
            const customPromptValue = document.getElementById('customPrompt').value.trim();
            if (!customPromptValue) {
                showToast('Please enter a custom prompt', 'error');
                return;
            }
            // Use the custom prompt exactly as entered without modification
            prompt = customPromptValue;
            isCustomPrompt = true;
        } else {
            prompt = getPromptForOption(currentAnalysisOption);
            isCustomPrompt = false;
        }
        
        console.log('Using prompt:', prompt);
        
        // Show a message about analysis
        showToast('Analyzing document...', 'info');
        
        // Prepare the request body
        const requestBody = {
            prompt: prompt,
            documentContent: window.extractedText || 'No text content available',
            analysisType: analysisType,
            analysisOption: currentAnalysisOption,
            documentName: currentFile.name,
            documentType: currentFile.type,
            options: {
                ocrEnabled: document.getElementById('ocrToggle').checked,
                isCustomPrompt: isCustomPrompt // Add this flag to API request
            }
        };
        
        // Update progress
        updateProgress(30, 'Processing request...');
        
        // Call the API for analysis
        const results = await simulateAnalysisApiCall(requestBody);
        console.log('Received analysis results');
        
        // Update progress
        updateProgress(90, 'Formatting response...');
        
        // Format and display the results
        const formattedResponse = formatMarkdown(results.content);
        
        if (resultsContent) {
            resultsContent.innerHTML = formattedResponse;
            console.log('Results displayed in UI');
        }
        
        // Save analysis to history
        saveAnalysisToHistory({
            documentName: currentFile.name,
            analysisType: currentAnalysisOption,
            timestamp: new Date().toISOString(),
            results: results.content,
            id: 'analysis-' + Date.now()
        });
        
        // Hide loading indicators
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (progressBar) progressBar.style.display = 'none';
        
        // Show results section
        if (resultsSection) {
            resultsSection.style.display = 'block';
            resultsSection.scrollIntoView({ behavior: 'smooth' });
        }
        
        // Store the results
        window.analysisResults = results.content;
        
        showToast('Analysis completed successfully!', 'success');
            
        } catch (error) {
        console.error('Error analyzing content:', error);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (progressBar) progressBar.style.display = 'none';
        showToast(`Error during analysis: ${error.message}`, 'error');
    }
}

// Convert file to data URL for image analysis
function convertFileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

// Get prompt for image analysis
function getPromptForImageAnalysis(option) {
    const basePrompt = "Analyze the following image and ";
    
    switch (option) {
        case 'summarize':
            return basePrompt + "provide a detailed description of what you see, covering main subjects, actions, setting, and overall context.";
        case 'extract-key-points':
            return basePrompt + "identify and list all key elements, objects, people, and visual features present in the image.";
        case 'sentiment':
            return basePrompt + "describe the emotional tone, mood, and atmosphere conveyed by the image.";
        case 'questions':
            return basePrompt + "generate 5 potential questions that this image might answer or address.";
        case 'entities':
            return basePrompt + "identify all people, objects, locations, brands, and other notable entities visible in the image.";
        default:
            return basePrompt + "provide a comprehensive analysis including description, context, and significance.";
    }
}

// API call for analysis using AI
async function simulateAnalysisApiCall(requestBody) {
    console.log('Making real API call with request:', requestBody);
    
    try {
        let apiPayload;
        
        // Different payload format for image vs text analysis
        if (requestBody.analysisType === 'image' && requestBody.documentType.includes('image')) {
            // For image analysis, we need to convert the image to base64
            const imageDataUrl = await convertFileToDataUrl(currentFile);
            
            // Use the flash model that works for both text and images
            const flashModel = 'advanced-flash';
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
            
            apiPayload = {
                contents: [
                    {
                        parts: [
                            { text: requestBody.prompt },
                            {
                                inline_data: {
                                    mime_type: requestBody.documentType,
                                    data: imageDataUrl.split(',')[1] // Remove the data:image/jpeg;base64, prefix
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 2048
                }
            };
            
            // Make API call to the flash model
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(apiPayload)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API error: ${errorData.error?.message || response.statusText}`);
            }
            
            const responseData = await response.json();
            console.log('API response for image:', responseData);
            
            const content = responseData.candidates[0].content.parts[0].text;
            return {
                content: content,
                analysisOption: requestBody.analysisOption, // Include the analysis option in the response
                timestamp: new Date().toISOString(),
                status: 'success'
            };
            
        } else {
            // For text analysis, use the standard model
            // Create a detailed prompt that explains the specific type of analysis
            let enhancedPrompt = requestBody.prompt;
            
            // Add clear instructions about the specific analysis type
            if (requestBody.analysisOption) {
                enhancedPrompt = `Please perform a specific analysis on the document: ${requestBody.analysisOption}.\n\n` +
                                 `Instructions for this analysis type: ${enhancedPrompt}\n\n` +
                                 `Please format your response as a detailed analysis focused specifically on the "${requestBody.analysisOption}" aspect.`;
            }
            
            apiPayload = {
                contents: [
                    {
                        parts: [
                            {
                                text: `${enhancedPrompt}\n\nDocument Content: ${requestBody.documentContent.substring(0, 10000)}` // Limit content length
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048
                }
            };
            
            // Make the actual API call
            const response = await fetch(`${API_URL}?key=${API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(apiPayload)
            });
            
            // Check if the response is successful
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API error: ${errorData.error?.message || response.statusText}`);
            }
            
            // Parse the response
            const responseData = await response.json();
            console.log('API response for text:', responseData);
            
            // Extract the content from the response
            const content = responseData.candidates[0].content.parts[0].text;
            
            return {
                content: content,
                analysisOption: requestBody.analysisOption, // Include the analysis option in the response
                timestamp: new Date().toISOString(),
                status: 'success'
            };
        }
        } catch (error) {
        console.error('Error calling API:', error);
        
        // Return a fallback response if the API call fails
        return {
            content: `# Analysis Error\n\nWe encountered an error while analyzing your document: ${error.message}\n\nPlease try again later or with a different document.`,
            analysisOption: requestBody.analysisOption,
            timestamp: new Date().toISOString(),
            status: 'error'
        };
    }
}

// Generate mock image analysis results
function generateMockImageAnalysis(analysisType) {
    switch (analysisType) {
            case 'summarize':
            return "# Image Description\n\nThe image shows a scenic landscape featuring mountains in the background with snow-capped peaks. In the foreground, there is a serene lake reflecting the mountain scenery. The sky displays a gradient of blue with some scattered clouds. Several pine trees line the shore of the lake, creating a classic nature composition. The lighting suggests either early morning or late afternoon, giving the scene a peaceful, contemplative mood.\n\n## Composition Details\n- Mountains form the backdrop with dramatic elevation\n- Reflective lake in the foreground creates symmetry\n- Forest elements frame the scene\n- Natural lighting enhances the atmosphere";
            
            case 'extract-key-points':
            return "# Key Elements in Image\n\n- Mountains with snow-capped peaks\n- Reflective lake or water body\n- Coniferous trees (likely pine or spruce)\n- Blue sky with scattered clouds\n- Natural landscape without visible human elements\n- Golden/warm lighting suggesting dawn or dusk\n- Perfect reflection in the water creating mirror effect\n- Depth perspective from foreground to background";
            
            case 'sentiment':
            return "# Emotional Tone Analysis\n\nThe image conveys a strong sense of **tranquility** and **serenity**. The calm water reflection and the majestic mountains create a feeling of **awe** and **wonder** at natural beauty. There's an underlying emotion of **peace** and **solitude**.\n\n## Mood Indicators\n- The soft lighting creates a **contemplative** atmosphere\n- The vast open space evokes a sense of **freedom**\n- The symmetry of the reflection suggests **harmony** and **balance**\n- The natural setting without human elements conveys **purity** and **escape** from civilization\n\nOverall sentiment: **Positive**, **calming**, and **inspirational**";
            
            case 'questions':
            return "# Questions This Image Addresses\n\n1. What makes natural reflections in water bodies so captivating to human perception?\n\n2. How do mountain landscapes impact human emotions and why are they often used in meditation and relaxation imagery?\n\n3. What geological processes formed these mountain ranges, and how old might these formations be?\n\n4. How does the time of day affect the mood and visual quality of landscape photography?\n\n5. What ecosystem exists in this alpine environment, and what wildlife might inhabit this area despite not being visible in the image?";
            
            case 'entities':
            return "# Entities Identified in Image\n\n## Natural Formations\n- Mountains (multiple peaks)\n- Lake/water body\n- Shoreline\n- Sky\n- Clouds\n\n## Vegetation\n- Coniferous trees (pine/spruce forest)\n- Alpine vegetation\n\n## Environmental Elements\n- Snow on mountain peaks\n- Water reflection\n- Natural lighting (likely sunset/sunrise)\n\n## Absent Elements\n- No visible human presence\n- No structures or buildings\n- No visible wildlife\n\nThis appears to be a pristine natural landscape without human intervention visible in the frame.";
            
            default:
            return "# Comprehensive Image Analysis\n\nThis natural landscape photograph captures the essence of wilderness and untouched nature. The composition follows the classic rule of thirds with the horizon line placed to maximize the impact of both the mountains and their reflection.\n\n## Visual Elements\nThe image features snow-capped mountains, a perfectly still lake creating mirror reflections, and coniferous trees along the shoreline. The color palette consists primarily of blues, greens, whites, and earth tones.\n\n## Technical Assessment\nThe photograph demonstrates excellent clarity and depth of field, with all elements from foreground to background in sharp focus. The lighting appears to be golden hour illumination, enhancing the scene with warm tones while maintaining natural color balance.\n\n## Cultural Context\nThis type of pristine landscape imagery is often associated with concepts of conservation, environmental protection, and the human desire to connect with unspoiled nature. Similar images are frequently used in tourism promotion, meditation apps, and environmental advocacy.";
    }
}

// Function to generate mock text analysis based on the selected option
function generateMockTextAnalysis(analysisType, text) {
    // This would be replaced with actual NLP processing in production
    // For demo purposes, we'll return prefabricated responses
    
    // Create a snippet of the text
    const snippet = text.substring(0, 200).trim() + "...";
    
    switch (analysisType) {
            case 'summarize':
            return `# Document Summary\n\nThis document discusses the key aspects of artificial intelligence and its applications in modern business environments. It covers machine learning algorithms, data processing techniques, and implementation strategies for organizations looking to leverage AI capabilities. The text emphasizes the importance of ethical considerations and proper data governance when deploying AI solutions.\n\n## Main Topics\n- Evolution of AI technologies\n- Machine learning implementation strategies\n- Data requirements and processing techniques\n- Ethical considerations and governance\n- Business applications and use cases`;
            
            case 'extract-key-points':
            return `# Key Points Extracted\n\n- Artificial intelligence systems require substantial amounts of quality data to function effectively\n- Machine learning models improve over time through continuous training and refinement\n- Organizations should establish clear governance frameworks for AI implementation\n- Ethical considerations must be prioritized when deploying automated decision systems\n- The ROI of AI initiatives depends on proper integration with existing business processes\n- Data privacy and security are foundational requirements for any AI system\n- Cross-functional teams yield better results when implementing AI solutions\n- Regular performance evaluation is essential for maintaining AI system quality`;
            
            case 'sentiment':
            return `# Sentiment Analysis Results\n\n## Overall Sentiment\nThe document displays a **neutral to slightly positive** tone (sentiment score: +0.32). The text maintains a professional and informative stance while discussing technical concepts.\n\n## Sentiment Breakdown\n- Introduction: Neutral (0.05)\n- Technical sections: Slightly negative (-0.15) - likely due to discussing challenges\n- Solution sections: Positive (+0.67) - emphasizes benefits and opportunities\n- Conclusion: Strongly positive (+0.82) - focuses on positive outcomes\n\n## Key Emotional Indicators\n- Trust: High (references to reliability, evidence, expertise)\n- Anticipation: Moderate (future benefits and developments)\n- Joy: Low to moderate (success stories and positive outcomes)\n- Fear: Low (minimal focus on risks and threats)\n\nThe document primarily aims to inform rather than persuade, with a slight optimistic bias toward the benefits of the technology.`;
            
            case 'questions':
            return `# Questions Generated from Document\n\n1. **What are the primary advantages of implementing machine learning algorithms in business operations?**\n   The document suggests several benefits including improved efficiency, better decision-making capabilities, and the ability to process large volumes of data quickly.\n\n2. **How should organizations approach data governance when deploying AI systems?**\n   According to the text, organizations should establish clear frameworks that address data quality, privacy, security, and ethical usage.\n\n3. **What technical infrastructure is required to support advanced AI applications?**\n   The document outlines requirements for computational resources, storage systems, and specialized hardware for training and inference.\n\n4. **How can businesses measure the return on investment for AI initiatives?**\n   The text discusses metrics such as efficiency gains, cost reduction, revenue increase, and improved decision quality as potential KPIs.\n\n5. **What ethical considerations should be prioritized when implementing automated decision systems?**\n   The document emphasizes transparency, fairness, accountability, and human oversight as key ethical principles.`;
            
            case 'entities':
            return `# Entities Extracted from Document\n\n## Organizations\n- Microsoft\n- Google DeepMind\n- OpenAI\n- IBM\n- Stanford AI Lab\n\n## Technologies\n- Neural Networks\n- Transformer Models\n- GPT Architecture\n- TensorFlow\n- PyTorch\n\n## People\n- Geoffrey Hinton\n- Yoshua Bengio\n- Andrew Ng\n- Fei-Fei Li\n- Ian Goodfellow\n\n## Concepts\n- Machine Learning\n- Deep Learning\n- Natural Language Processing\n- Computer Vision\n- Reinforcement Learning\n\n## Locations\n- Silicon Valley\n- MIT\n- Berkeley\n- Toronto (Vector Institute)\n- Beijing (BAAI)`;
            
            default:
            return `# Document Analysis\n\nThis analysis examined the provided text which appears to be focused on technical content related to information technology or software development. The document contains approximately ${Math.floor(text.length / 5)} words across multiple sections.\n\n## Content Overview\nThe text begins with ${snippet}\n\n## Structure Analysis\nThe document follows a logical structure with clear sections, technical terminology, and explanatory content. It appears to be written for an audience with some technical knowledge of the subject matter.\n\n## Recommendations\nThis content would benefit from additional visual elements, more concrete examples, and possibly case studies to illustrate the concepts discussed. The technical terminology is appropriate but could be supplemented with a glossary for less experienced readers.`;
    }
}

// Process PDF file
async function processPDF(file) {
    try {
        updateProgress(10, 'Processing PDF...');
        
        // Read file as array buffer
        const arrayBuffer = await readFileAsArrayBuffer(file);
        
        // Load PDF using pdf.js
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        updateProgress(30, 'PDF loaded, extracting text...');
        
        // Store metadata
        window.pdfDocument = pdf;
        window.pdfName = file.name;
        window.pageCount = pdf.numPages;
        
        // Extract text from all pages
        let extractedContent = '';
        const numPages = pdf.numPages;
        
        // Use OCR if enabled
        const ocrEnabled = document.getElementById('ocrToggle').checked;
        
        if (ocrEnabled) {
            updateProgress(40, 'OCR processing started for PDF pages...');
            
            try {
                extractedContent = await performOCR(pdf, numPages);
                console.log('OCR processing completed successfully');
            } catch (ocrError) {
                console.error('OCR processing failed:', ocrError);
                showToast('OCR processing failed, falling back to text extraction', 'warning');
                
                // Fall back to standard text extraction
                extractedContent = await extractTextFromPDF(pdf, numPages);
            }
        } else {
            // Extract text using PDF.js
            extractedContent = await extractTextFromPDF(pdf, numPages);
        }
        
        updateProgress(70, 'Detecting tables and structure...');
        
        // Detect tables in the content
        const { content, tables } = await detectTables(extractedContent);
        
        // Store the extracted text for later use
        window.extractedText = content;
        window.pdfText = content;
        window.pdfTables = tables || [];
        
        // Store the file data for reuse
        window.currentFileData = arrayBuffer;
        
        updateProgress(100, 'Processing complete!');
        
        return {
            success: true,
            text: content,
            pageCount: numPages,
            tables: tables
        };
    } catch (error) {
        console.error('Error processing PDF:', error);
        showToast(`Error processing PDF: ${error.message}`, 'error');
        
        // Try to provide helpful information about the error
        let errorMessage = 'Unable to process this PDF. ';
        if (error.message.includes('password')) {
            errorMessage += 'This file appears to be password-protected.';
        } else if (error.message.includes('corrupted')) {
            errorMessage += 'The file may be corrupted or incomplete.';
        } else if (error.message.includes('linearization')) {
            errorMessage += 'The file structure is invalid.';
        } else {
            errorMessage += 'Please try a different file.';
        }
        
        showToast(errorMessage, 'error');
        
        return {
            success: false,
            error: errorMessage
        };
    }
}

// New helper function to extract text from PDF pages
async function extractTextFromPDF(pdf, numPages) {
    let extractedContent = '';
    
    for (let i = 1; i <= numPages; i++) {
        try {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            // Extract the text and maintain some structure
            const structured = extractStructuredText(textContent, page.getViewport({ scale: 1 }));
            extractedContent += `[Page ${i}]\n${structured}\n\n`;
            
            // Update progress for each page
            updateProgress(30 + Math.floor(40 * (i / numPages)), `Extracting text from page ${i} of ${numPages}...`);
        } catch (pageError) {
            console.error(`Error extracting text from page ${i}:`, pageError);
            extractedContent += `[Page ${i} - Text Extraction Failed]\n\n`;
        }
    }
    
    return extractedContent;
}

// Process image file
async function processImage(file) {
    try {
        updateProgress(10, 'Processing image...');
        
        // Load the image
        const img = await loadImage(file);
        updateProgress(30, 'Image loaded, extracting text...');
        
        // Store metadata
        window.imageName = file.name;
        window.imageData = img;
        
        // Use OCR if enabled
        const ocrEnabled = document.getElementById('ocrToggle').checked;
        let extractedContent = '';
        
        if (ocrEnabled) {
            updateProgress(40, 'Performing OCR on image...');
            extractedContent = await performImageOCR(img);
        } else {
            extractedContent = 'OCR is disabled. Enable OCR to extract text from this image.';
        }
        
        // Store the extracted text
        window.extractedText = extractedContent;
        
        updateProgress(70, 'Text extraction complete');
        
        return { text: extractedContent };
    } catch (error) {
        console.error('Error processing image:', error);
        throw new Error('Failed to process image: ' + error.message);
    }
}

// Process Word document
async function processWordDocument(file) {
    try {
        updateProgress(10, 'Processing Word document...');
        
        // This is a simplified implementation
        // In a real app, you would use a Word document parsing library
        
        // Show a message about Word document support
        updateProgress(50, 'Extracting text from Word document...');
        
        // For demo purposes, just read as text
        const text = await readFileAsText(file);
        
        // Store the extracted text
        window.extractedText = text;
        
        updateProgress(70, 'Text extraction complete');
        
        return { text };
    } catch (error) {
        console.error('Error processing Word document:', error);
        throw new Error('Failed to process Word document: ' + error.message);
    }
}

// Process text file
async function processTextFile(file) {
    try {
        updateProgress(10, 'Processing text file...');
        
        // Read file as text
        const text = await readFileAsText(file);
        updateProgress(50, 'Text loaded');
        
        // Store the extracted text
        window.extractedText = text;
        
        updateProgress(70, 'Processing complete');
        
        return { text };
    } catch (error) {
        console.error('Error processing text file:', error);
        throw new Error('Failed to process text file: ' + error.message);
    }
}

// Helper function to load image from file
function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

// Helper function to read file as text
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

// Helper function to read file as array buffer
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Perform OCR on PDF pages
async function performOCR(pdf, numPages) {
    // This is a simplified implementation
    // In a real app, you would use a proper OCR library like Tesseract.js
    
    let extractedText = '';
    
    // Simulate OCR processing
    for (let i = 1; i <= numPages; i++) {
        updateProgress(40 + (i / numPages) * 20, `OCR processing page ${i}/${numPages}...`);
        
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        
        // Render page to canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        
        // In a real implementation, you would now pass this canvas to Tesseract
        // For now, we'll just get the text content from PDF.js
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        
        extractedText += `--- Page ${i} ---\n${pageText}\n\n`;
    }
    
    return extractedText;
}

// Perform OCR on images
async function performImageOCR(img) {
    // This is a simplified implementation
    // In a real app, you would use a proper OCR library like Tesseract.js
    
    // Simulate OCR processing
    updateProgress(50, 'Performing image text recognition...');
    
    // For the demo, return a placeholder text
    return "Image OCR completed. This is a simulated result since actual OCR requires integration with services like Tesseract.js or cloud OCR APIs.";
}

// Extract structured text from PDF text content
function extractStructuredText(textContent, viewPort) {
    // Group text items by their y-position to identify lines
    const textItems = textContent.items;
    const lines = {};
    
    // Threshold for considering items on the same line (in viewport units)
    const lineThreshold = 5;
    
    // Process each text item
    textItems.forEach(item => {
        // Get the y position, rounded to account for small variations
        const yPos = Math.round(item.transform[5] / lineThreshold) * lineThreshold;
        
        // Create line if it doesn't exist
        if (!lines[yPos]) {
            lines[yPos] = [];
        }
        
        // Add item to line
        lines[yPos].push({
            text: item.str,
            x: item.transform[4],
            width: item.width
        });
    });
    
    // Sort lines by y-position (top to bottom)
    const sortedLineKeys = Object.keys(lines).map(Number).sort((a, b) => b - a);
    
    // For each line, sort items by x-position (left to right)
    sortedLineKeys.forEach(yPos => {
        lines[yPos].sort((a, b) => a.x - b.x);
    });
    
    // Combine into final text
    let result = '';
    sortedLineKeys.forEach(yPos => {
        const lineText = lines[yPos].map(item => item.text).join(' ');
        result += lineText + '\n';
    });
    
    return result;
}

// Update progress bar
function updateProgress(percent, message) {
    const progressBar = document.querySelector('.progress-bar');
    const progressText = document.querySelector('.progress-text');
    
    if (progressBar && progressText) {
        progressBar.style.width = `${percent}%`;
        progressText.textContent = message || `${Math.round(percent)}%`;
    }
}

// Format markdown for display
function formatMarkdown(text) {
    if (!text) return '';
    
    // Convert headers
        text = text.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
    text = text.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    text = text.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    text = text.replace(/^#### (.*?)$/gm, '<h4>$1</h4>');
    
    // Convert bold and italic
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Convert bullet lists
        text = text.replace(/^- (.*?)$/gm, '<li>$1</li>');
    text = text.replace(/^• (.*?)$/gm, '<li>$1</li>');
    text = text.replace(/^\* (.*?)$/gm, '<li>$1</li>');
        
    // Group list items
    text = text.replace(/(<li>.*?<\/li>(\n|$))+/g, '<ul>$&</ul>');
        
    // Convert line breaks
        text = text.replace(/\n/g, '<br>');
    
    // Cleanup list markup
    text = text.replace(/<br><ul>/g, '<ul>');
    text = text.replace(/<\/ul><br>/g, '</ul>');
    text = text.replace(/<\/li><br>/g, '</li>');
        
        return text;
    }
    
// Function to detect tables in text
async function detectTables(extractedContent) {
    try {
        console.log('Detecting tables in extracted content...');
        
        if (!extractedContent || typeof extractedContent !== 'string') {
            console.error('Invalid content passed to detectTables:', typeof extractedContent);
            return { 
                content: extractedContent || '', 
                tables: [] 
            };
        }
        
        // This is a simplified implementation
        // In a real app, you would use more sophisticated table detection algorithms
        
        // Simulate table detection
        const tableRegex = /(\+[-+]+\+[\s\S]+?\+[-+]+\+)|(\|[^\n]+\|[^\n]+\|[^\n]+\|)/g;
        const matches = extractedContent.match(tableRegex) || [];
        
        // Process matches into table data
        const tables = matches.map((match, index) => {
            return {
                id: `table-${index}`,
                content: match,
                rows: match.split('\n').filter(line => line.trim().length > 0).length,
                detected: true
            };
        });
        
        console.log(`Detected ${tables.length} tables in content`);
        
        // Return both the original content and the tables
        return {
            content: extractedContent,
            tables: tables
        };
    } catch (error) {
        console.error('Error detecting tables:', error);
        return {
            content: extractedContent || '',
            tables: []
        };
    }
}

// Update document list in the sidebar
function updateDocumentList() {
    const documentList = document.getElementById('documentList');
    const docCount = document.querySelector('.doc-count');
    
    if (!documentList || !window.documentCollection) return;
    
    // Clear existing list
    documentList.innerHTML = '';
    
    // Update document count
    if (docCount) {
        docCount.textContent = `${window.documentCollection.length} document${window.documentCollection.length !== 1 ? 's' : ''}`;
    }
    
    // No documents message
    if (window.documentCollection.length === 0) {
        documentList.innerHTML = '<p class="no-documents">No documents uploaded yet</p>';
        return;
    }
    
    // Add each document to the list
    window.documentCollection.forEach((doc, index) => {
        const docItem = document.createElement('div');
        docItem.className = 'doc-item';
        docItem.innerHTML = `
            <div class="doc-info">
                <div class="doc-name">${doc.name}</div>
                <div class="doc-meta">${getFileTypeLabel(doc.type)} • ${formatDate(doc.processingDate)}</div>
            </div>
            <div class="doc-actions">
                <button class="doc-action-btn" data-action="analyze" data-doc-id="${index}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="16"></line>
                        <line x1="8" y1="12" x2="16" y2="12"></line>
                    </svg>
                </button>
                <button class="doc-action-btn" data-action="remove" data-doc-id="${index}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `;
        
        documentList.appendChild(docItem);
    });
    
    // Add event listeners to document action buttons
    const actionButtons = documentList.querySelectorAll('.doc-action-btn');
    actionButtons.forEach(btn => {
        btn.addEventListener('click', handleDocAction);
    });
}

// Handle document actions (analyze, remove)
function handleDocAction(e) {
    const action = e.currentTarget.getAttribute('data-action');
    const docId = parseInt(e.currentTarget.getAttribute('data-doc-id'));
    
    if (action === 'analyze') {
        // Reload the document for analysis
        const doc = window.documentCollection[docId];
        if (doc) {
            window.currentFileData = { name: doc.name, type: doc.type };
            window.extractedText = doc.text;
            window.pdfText = doc.text;
            
            // Show analysis options
            showToast(`Document "${doc.name}" loaded for analysis`, 'info');
        }
    } else if (action === 'remove') {
        // Remove the document from collection
        if (window.documentCollection && window.documentCollection[docId]) {
            const name = window.documentCollection[docId].name;
            window.documentCollection.splice(docId, 1);
            updateDocumentList();
            showToast(`Document "${name}" removed`, 'success');
        }
    }
}

// Helper function to get file type label
function getFileTypeLabel(mimeType) {
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('word')) return 'Word';
    if (mimeType.includes('image')) return 'Image';
    if (mimeType.includes('text')) return 'Text';
    return 'Document';
}

// Helper function to format date
function formatDate(date) {
    if (!date) return '';
    
    const options = { month: 'short', day: 'numeric' };
    return new Date(date).toLocaleDateString(undefined, options);
}

// Show toast notification
function showToast(message, type = 'success') {
    let toastContainer = document.querySelector('.toast-container');
    
    // Create toast container if it doesn't exist
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // Add toast to container
    toastContainer.appendChild(toast);
    
    // Show toast
        setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Remove toast after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toastContainer.removeChild(toast);
            
            // Remove container if empty
            if (toastContainer.children.length === 0) {
                document.body.removeChild(toastContainer);
            }
        }, 300);
    }, 3000);
}

// Enhanced displayFilePreview function for better viewing experience
function displayFilePreview(file) {
    console.log('Enhanced displaying preview for file:', file.name);
    
    const previewSection = document.getElementById('filePreview');
    const previewFileName = document.getElementById('previewFileName');
    const pdfPreview = document.getElementById('pdfPreview');
    const imagePreview = document.getElementById('imagePreview');
    const textPreview = document.getElementById('textPreview');
    
    if (!previewSection || !previewFileName) {
        console.error('Preview elements not found in the DOM');
        return;
    }
    
    // Set file name in preview header
    previewFileName.textContent = file.name;
    
    // Show the preview section immediately
    previewSection.style.display = 'block';
    
    // Clear any existing fullscreen buttons
    const existingFullscreenBtns = document.querySelectorAll('.fullscreen-btn');
    existingFullscreenBtns.forEach(btn => btn.remove());
    
    // Hide all preview types initially
    if (pdfPreview) pdfPreview.style.display = 'none';
    if (imagePreview) imagePreview.style.display = 'none';
    if (textPreview) textPreview.style.display = 'none';
    
    // Show loading indicator
    showToast('Loading preview...', 'info');
    
    // Process different file types for preview
    if (file.type.includes('pdf')) {
        if (pdfPreview) {
            pdfPreview.style.display = 'flex';
            displayPdfPreview(file);
        }
    } else if (file.type.includes('image')) {
        if (imagePreview) {
            imagePreview.style.display = 'flex';
            displayImagePreview(file);
        }
    } else {
        if (textPreview) {
            textPreview.style.display = 'flex';
            displayTextPreview(file);
        }
    }
    
    // Add a click handler to close button
    const closePreviewBtn = document.getElementById('closePreview');
    if (closePreviewBtn) {
        closePreviewBtn.addEventListener('click', () => {
            previewSection.style.display = 'none';
        });
    }
    
    // Auto-select the appropriate analysis type based on file type
    autoSelectAnalysisType(file);
    
    // Add controls for zooming and navigation (for all file types)
    addAdvancedViewingControls(file);
}

// Function to add advanced viewing controls
function addAdvancedViewingControls(file) {
    const previewContent = document.querySelector('.preview-content');
    if (!previewContent) return;
    
    // Add viewer controls container if it doesn't exist
    let viewerControls = document.querySelector('.viewer-controls');
    if (!viewerControls) {
        viewerControls = document.createElement('div');
        viewerControls.className = 'viewer-controls';
        previewContent.appendChild(viewerControls);
    } else {
        // Clear existing controls
        viewerControls.innerHTML = '';
    }
    
    // Add fullscreen button
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'viewer-control-btn fullscreen-btn';
    fullscreenBtn.title = 'Toggle Fullscreen';
    fullscreenBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3"></path>
            <path d="M21 8V5a2 2 0 0 0-2-2h-3"></path>
            <path d="M3 16v3a2 2 0 0 0 2 2h3"></path>
            <path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>
        </svg>
    `;
    
    // Determine which type of content to put in fullscreen
    let previewType = 'text';
    if (file.type.includes('pdf')) {
        previewType = 'pdf';
    } else if (file.type.includes('image')) {
        previewType = 'image';
    }
    
    fullscreenBtn.addEventListener('click', () => toggleFullscreen(previewType));
    viewerControls.appendChild(fullscreenBtn);
    
    // Add zoom controls
    const zoomInBtn = document.createElement('button');
    zoomInBtn.className = 'viewer-control-btn zoom-in-btn';
    zoomInBtn.title = 'Zoom In';
    zoomInBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="11" y1="8" x2="11" y2="14"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
        </svg>
    `;
    zoomInBtn.addEventListener('click', () => zoomContent(true, previewType));
    viewerControls.appendChild(zoomInBtn);
    
    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.className = 'viewer-control-btn zoom-out-btn';
    zoomOutBtn.title = 'Zoom Out';
    zoomOutBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
        </svg>
    `;
    zoomOutBtn.addEventListener('click', () => zoomContent(false, previewType));
    viewerControls.appendChild(zoomOutBtn);
    
    // Add rotate button for images
    if (file.type.includes('image')) {
        const rotateBtn = document.createElement('button');
        rotateBtn.className = 'viewer-control-btn rotate-btn';
        rotateBtn.title = 'Rotate Image';
        rotateBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
        `;
        rotateBtn.addEventListener('click', rotateImage);
        viewerControls.appendChild(rotateBtn);
    }
    
    // Add download button
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'viewer-control-btn download-btn';
    downloadBtn.title = 'Download File';
    downloadBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
    `;
    downloadBtn.addEventListener('click', () => downloadFile(file));
    viewerControls.appendChild(downloadBtn);
}

// Function to zoom in/out of content
function zoomContent(zoomIn, previewType) {
    let element = null;
    let currentScale = 1;
    
    if (previewType === 'pdf') {
        element = document.getElementById('pdfCanvas');
        const scaleMatch = (element.style.transform || '').match(/scale\(([0-9.]+)\)/);
        currentScale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
    } else if (previewType === 'image') {
        element = document.getElementById('previewImg');
        const scaleMatch = (element.style.transform || '').match(/scale\(([0-9.]+)\)/);
        currentScale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
    } else {
        element = document.getElementById('textPreview');
        const fontSize = window.getComputedStyle(element).fontSize;
        currentScale = parseFloat(fontSize) / 16; // Assuming 16px is the base font size
    }
    
    // Calculate new scale
    const scaleFactor = zoomIn ? 1.2 : 0.8;
    const newScale = currentScale * scaleFactor;
    
    // Apply new scale
    if (previewType === 'pdf' || previewType === 'image') {
        element.style.transform = `scale(${newScale})`;
    } else {
        element.style.fontSize = `${newScale * 16}px`; // Scale the font size
    }
}

// Function to rotate image
function rotateImage() {
    const img = document.getElementById('previewImg');
    if (!img) return;
    
    // Get current rotation
    const currentTransform = img.style.transform || '';
    const rotateMatch = currentTransform.match(/rotate\(([0-9]+)deg\)/);
    const currentRotation = rotateMatch ? parseInt(rotateMatch[1]) : 0;
    
    // Calculate new rotation
    const newRotation = (currentRotation + 90) % 360;
    
    // Extract scale if it exists
    const scaleMatch = currentTransform.match(/scale\(([0-9.]+)\)/);
    const currentScale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
    
    // Apply new transform
    img.style.transform = `rotate(${newRotation}deg) scale(${currentScale})`;
}

// Function to download the file
function downloadFile(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('File downloaded', 'success');
}

// Enhanced toggleFullscreen function
function toggleFullscreen(previewType) {
    console.log('Toggling fullscreen for', previewType);
    
    const isFullscreen = document.body.classList.contains('has-fullscreen');
    
    // Elements for different preview types
    const pdfPreview = document.getElementById('pdfPreview');
    const imagePreview = document.getElementById('imagePreview');
    const textPreview = document.getElementById('textPreview');
    
    // Get the element to make fullscreen based on preview type
    let targetElement = null;
    switch (previewType) {
        case 'pdf':
            targetElement = pdfPreview;
            break;
        case 'image':
            targetElement = imagePreview;
            break;
        case 'text':
            targetElement = textPreview;
            break;
    }
    
    if (!targetElement) {
        console.error('Target element for fullscreen not found');
        return;
    }
    
    if (isFullscreen) {
        // Exit fullscreen
        targetElement.classList.remove('fullscreen-preview');
        document.body.classList.remove('has-fullscreen');
        
        // If in browser fullscreen mode, exit it
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(err => console.error('Error exiting fullscreen:', err));
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
        
        showToast('Exited fullscreen mode', 'info');
    } else {
        // Enter fullscreen
        targetElement.classList.add('fullscreen-preview');
        document.body.classList.add('has-fullscreen');
        
        // Try to use the browser's fullscreen API
        if (targetElement.requestFullscreen) {
            targetElement.requestFullscreen().catch(err => {
                console.warn('Could not enter browser fullscreen, using CSS fullscreen:', err);
            });
        } else if (targetElement.webkitRequestFullscreen) {
            targetElement.webkitRequestFullscreen();
        } else if (targetElement.mozRequestFullScreen) {
            targetElement.mozRequestFullScreen();
        } else if (targetElement.msRequestFullscreen) {
            targetElement.msRequestFullscreen();
        }
        
        showToast('Entered fullscreen mode', 'info');
    }
}

// Enhanced displayPdfPreview function
function displayPdfPreview(file) {
    console.log('Enhanced PDF preview for file:', file.name);
    
    // Convert file to ArrayBuffer for PDF.js
    const reader = new FileReader();
    reader.onload = function(event) {
        const arrayBuffer = event.target.result;
        displayPdfFromArrayBuffer(arrayBuffer, file.name);
    };
    
    reader.onerror = function(event) {
        console.error('Error reading PDF file:', event);
        showToast('Error loading PDF file', 'error');
    };
    
    // Start reading the file as ArrayBuffer
    reader.readAsArrayBuffer(file);
}

// Enhanced displayPdfFromArrayBuffer function
function displayPdfFromArrayBuffer(arrayBuffer, filename) {
    console.log('Enhanced PDF display from ArrayBuffer for:', filename);
    
    const pdfPreview = document.getElementById('pdfPreview');
    const canvas = document.getElementById('pdfCanvas');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');
    
    if (!pdfPreview || !canvas || !prevPageBtn || !nextPageBtn || !pageInfo) {
        console.error('PDF preview elements not found');
        return;
    }
    
    // Show loading indicator
    showToast('Loading PDF...', 'info');
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    loadingTask.promise.then(function(pdf) {
        console.log('PDF loaded successfully with', pdf.numPages, 'pages');
        
        // Store the PDF and current page globally
        window.pdfDocument = pdf;
        window.currentPage = 1;
        window.pdfName = filename;
        
        // Clear any existing pdf pages
        while (canvas.nextSibling) {
            if (canvas.nextSibling.tagName === 'CANVAS') {
                pdfPreview.removeChild(canvas.nextSibling);
            } else {
                break;
            }
        }
        
        // Render the first page
        renderPdfPage(pdf, 1);
        
        // Update page controls
        updatePageControls(1, pdf.numPages);
        
        // Add event listeners to page navigation buttons
        prevPageBtn.onclick = function() {
            if (window.currentPage <= 1) return;
            window.currentPage--;
            renderPdfPage(window.pdfDocument, window.currentPage);
            updatePageControls(window.currentPage, window.pdfDocument.numPages);
        };
        
        nextPageBtn.onclick = function() {
            if (window.currentPage >= window.pdfDocument.numPages) return;
            window.currentPage++;
            renderPdfPage(window.pdfDocument, window.currentPage);
            updatePageControls(window.currentPage, window.pdfDocument.numPages);
        };
        
        // Add keyboard navigation
        document.addEventListener('keydown', function(e) {
            if (!window.pdfDocument) return;
            
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                if (window.currentPage > 1) {
                    window.currentPage--;
                    renderPdfPage(window.pdfDocument, window.currentPage);
                    updatePageControls(window.currentPage, window.pdfDocument.numPages);
                }
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                if (window.currentPage < window.pdfDocument.numPages) {
                    window.currentPage++;
                    renderPdfPage(window.pdfDocument, window.currentPage);
                    updatePageControls(window.currentPage, window.pdfDocument.numPages);
                }
            }
        });
        
        showToast('PDF loaded successfully', 'success');
    }).catch(function(error) {
        console.error('Error loading PDF:', error);
        showToast('Error loading PDF: ' + (error.message || 'Unknown error'), 'error');
    });
}

// Enhanced displayImagePreview function
function displayImagePreview(file) {
    console.log('Enhanced image preview for file:', file.name);
    
    const imagePreview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    
    if (!imagePreview || !previewImg) {
        console.error('Image preview elements not found');
        return;
    }
    
    // Show loading indicator
    showToast('Loading image...', 'info');
    
    // Set up image loading
    previewImg.onload = function() {
        window.imageName = file.name;
        showToast('Image loaded successfully', 'success');
    };
    
    previewImg.onerror = function() {
        console.error('Error loading image');
        showToast('Error loading image', 'error');
    };
    
    // Create a URL for the image
    const imageUrl = URL.createObjectURL(file);
    previewImg.src = imageUrl;
    
    // Store the URL to revoke it later
    previewImg.dataset.imageUrl = imageUrl;
    
    // Clean up when image is changed or preview is closed
    return function cleanup() {
        if (previewImg.dataset.imageUrl) {
            URL.revokeObjectURL(previewImg.dataset.imageUrl);
            previewImg.dataset.imageUrl = null;
        }
    };
}

// Enhanced displayTextPreview function
function displayTextPreview(file) {
    console.log('Enhanced text preview for file:', file.name);
    
    const textPreview = document.getElementById('textPreview');
    const previewText = document.getElementById('previewText');
    
    if (!textPreview || !previewText) {
        console.error('Text preview elements not found');
        return;
    }
    
    // Show loading indicator
    showToast('Loading text...', 'info');
    
    // Read the file as text
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const content = e.target.result;
        previewText.textContent = content;
        window.textName = file.name;
        showToast('Text loaded successfully', 'success');
    };
    
    reader.onerror = function(e) {
        console.error('Error reading text file:', e);
        showToast('Error loading text file', 'error');
    };
    
    reader.readAsText(file);
}

// Auto-select appropriate analysis type based on file type
function autoSelectAnalysisType(file) {
    const documentRadio = document.querySelector('input[value="document"]');
    const imageRadio = document.querySelector('input[value="image"]');
    
    if (!documentRadio || !imageRadio) return;
    
    if (file.type.includes('image')) {
        imageRadio.checked = true;
        // For images, default to entity extraction or description
        selectAnalysisOption('entities');
    } else {
        documentRadio.checked = true;
        // For documents, default to summarize
        selectAnalysisOption('summarize');
    }
}

// Select analysis option
function selectAnalysisOption(option) {
    // Deactivate all options first
    const optionBtns = document.querySelectorAll('.option-btn');
    optionBtns.forEach(btn => btn.classList.remove('active'));
    
    // Activate the selected option
    const selectedBtn = document.querySelector(`.option-btn[data-option="${option}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }
    
    // Store the current analysis option
    currentAnalysisOption = option;
    
    // Toggle custom prompt visibility
    const customPromptContainer = document.querySelector('.custom-prompt-container');
    if (customPromptContainer) {
        isCustomPrompt = option === 'custom';
        customPromptContainer.style.display = option === 'custom' ? 'block' : 'none';
        
        // If showing custom prompt, focus it after a brief delay
        if (option === 'custom') {
            setTimeout(() => {
                const customPrompt = document.getElementById('customPrompt');
                if (customPrompt) {
                    customPrompt.focus();
                }
            }, 100);
            
            // Add pulse animation to the container
            customPromptContainer.classList.add('pulse-animation');
            
            // Remove it after animation completes
            setTimeout(() => {
                customPromptContainer.classList.remove('pulse-animation');
            }, 1000);
        }
    }
}

function initViewSampleButtons() {
    const viewButtons = document.querySelectorAll('.view-sample-btn');
    viewButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the parent sample file click
            const filePath = button.getAttribute('data-file');
            viewSampleFile(filePath);
        });
    });
}

async function viewSampleFile(filePath) {
    try {
        console.log(`Attempting to view sample file at path: ${filePath}`);
        showToast(`Loading ${filePath.split('/').pop()}...`, 'info');
        
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
        }
        
        console.log('File fetch response:', response.status, response.statusText);
        const fileType = getFileExtension(filePath);
        console.log('Detected file type:', fileType);
        
        // Clone the response before using it, so we can use it again later
        const responseClone = response.clone();
        
        // Determine the mime type based on file extension
        let mimeType;
        if (fileType === 'pdf') {
            mimeType = 'application/pdf';
        } else if (['jpg', 'jpeg'].includes(fileType)) {
            mimeType = 'image/jpeg';
        } else if (fileType === 'png') {
            mimeType = 'image/png';
        } else if (fileType === 'gif') {
            mimeType = 'image/gif';
        } else {
            mimeType = 'application/octet-stream';
        }
        
        // Create a File object that can be used with our processor functions
        const blob = await responseClone.blob();
        const file = new File(
            [blob], 
            filePath.split('/').pop(), 
            { type: mimeType }
        );
        
        console.log('Created file object:', file);
        
        // Process the file using our standard processors
        let processedData;
        if (fileType === 'pdf') {
            processedData = await processPDF(file);
            if (!processedData.success) {
                throw new Error(processedData.error || 'Failed to process PDF');
            }
            
            // Also display the PDF preview
            displayPdfFromArrayBuffer(await blob.arrayBuffer(), file.name);
        } else if (['jpg', 'jpeg', 'png', 'gif'].includes(fileType)) {
            processedData = await processImage(file);
            displayImagePreview(file);
        } else {
            processedData = await processTextFile(file);
            displayTextPreview(file);
        }
        
        // Store the processed file data
        currentFile = file;
        window.extractedText = processedData.text || '';
        
        // Show the file preview container
        document.getElementById('filePreview').style.display = 'block';
        
        // Auto-select appropriate analysis type
        autoSelectAnalysisType(file);
        
        // Add to document collection if not already present
        if (!window.documentCollection) {
            window.documentCollection = [];
        }
        
        // Check if document already exists in collection
        const existingDocIndex = window.documentCollection.findIndex(doc => 
            doc.name === file.name
        );
        
        if (existingDocIndex === -1) {
            // Add to document collection
            window.documentCollection.push({
                id: `doc-${Date.now()}`,
                name: file.name,
                type: file.type,
                size: file.size,
                processingDate: new Date(),
                text: processedData.text || '',
                pageCount: processedData.pageCount || 1,
                metadata: processedData.metadata || {}
            });
            
            // Update document list in sidebar
            updateDocumentList();
            
            showToast(`${file.name} added to your document collection`, 'success');
        } else {
            showToast(`${file.name} loaded for analysis`, 'info');
        }
        
    } catch (error) {
        console.error('Error viewing sample file:', error);
        // More user-friendly error message
        showToast(`Sample file is loading, please wait a moment and try again.`, 'info');
    }
}

function getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase();
}

function initConfirmationDialog() {
    const startAnalysisBtn = document.getElementById('startAnalysisBtn');
    const analysisConfirmation = document.getElementById('analysisConfirmation');
    const confirmAnalysisBtn = document.getElementById('confirmAnalysisBtn');
    const cancelAnalysisBtn = document.getElementById('cancelAnalysisBtn');
    const closeConfirmDialog = document.getElementById('closeConfirmDialog');
    
    if (startAnalysisBtn && analysisConfirmation) {
        startAnalysisBtn.addEventListener('click', showConfirmationDialog);
        
        if (confirmAnalysisBtn) {
            confirmAnalysisBtn.addEventListener('click', () => {
                analysisConfirmation.style.display = 'none';
                analyzeContent();
            });
        }
        
        if (cancelAnalysisBtn) {
            cancelAnalysisBtn.addEventListener('click', () => {
                analysisConfirmation.style.display = 'none';
            });
        }
        
        if (closeConfirmDialog) {
            closeConfirmDialog.addEventListener('click', () => {
                analysisConfirmation.style.display = 'none';
            });
        }
    }
}

function showConfirmationDialog() {
    const analysisConfirmation = document.getElementById('analysisConfirmation');
    const confirmFileName = document.getElementById('confirmFileName');
    const confirmAnalysisType = document.getElementById('confirmAnalysisType');
    const confirmOperation = document.getElementById('confirmOperation');
    const confirmOcr = document.getElementById('confirmOcr');
    const confirmCustomPrompt = document.getElementById('confirmCustomPrompt');
    const customPromptPreview = document.getElementById('customPromptPreview');
    
    if (!currentFile) {
        showToast('Please upload or select a document first', 'error');
        return;
    }
    
    // Set confirmation details
    confirmFileName.textContent = currentFile.name || 'Unnamed document';
    
    // Get selected analysis type
    const analysisTypeValue = document.querySelector('input[name="analysisType"]:checked').value;
    confirmAnalysisType.textContent = analysisTypeValue === 'document' ? 'Document Analysis' : 'Image Description';
    
    // Get selected operation
    const activeOptionBtn = document.querySelector('.option-btn.active');
    if (activeOptionBtn) {
        confirmOperation.textContent = activeOptionBtn.textContent;
    } else {
        confirmOperation.textContent = 'Custom Analysis';
    }
    
    // Check if OCR is enabled
    const ocrToggle = document.getElementById('ocrToggle');
    confirmOcr.textContent = ocrToggle && ocrToggle.checked ? 'Yes' : 'No';
    
    // Handle custom prompt
    if (isCustomPrompt) {
        const customPromptText = document.getElementById('customPrompt').value;
        customPromptPreview.textContent = customPromptText || 'No custom prompt provided';
        confirmCustomPrompt.style.display = 'block';
    } else {
        confirmCustomPrompt.style.display = 'none';
    }
    
    // Show the confirmation dialog with animation
    analysisConfirmation.style.display = 'flex';
    setTimeout(() => {
        analysisConfirmation.classList.add('visible');
    }, 10);
}

function initKeyboardShortcuts() {
    document.addEventListener('keydown', handleKeyboardShortcut);
    
    // Bind keyboard shortcuts help dialog
    const quickHelp = document.getElementById('quickHelp');
    const keyboardShortcuts = document.getElementById('keyboardShortcuts');
    const closeShortcutsBtn = document.getElementById('closeShortcutsBtn');
    
    if (quickHelp && keyboardShortcuts) {
        quickHelp.addEventListener('click', () => {
            keyboardShortcuts.style.display = 'flex';
            setTimeout(() => {
                keyboardShortcuts.classList.add('visible');
            }, 10);
        });
        
        if (closeShortcutsBtn) {
            closeShortcutsBtn.addEventListener('click', () => {
                keyboardShortcuts.classList.remove('visible');
                setTimeout(() => {
                    keyboardShortcuts.style.display = 'none';
        }, 300);
    });
        }
    }
}

function handleKeyboardShortcut(e) {
    // Ctrl + O: Open file
    if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        document.getElementById('fileInput').click();
    }
    
    // Ctrl + Enter: Start Analysis
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (currentFile) {
            showConfirmationDialog();
        } else {
            showToast('Please upload or select a document first', 'error');
        }
    }
    
    // Ctrl + S: Save analysis results
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        const results = document.querySelector('.results-section');
        if (results && results.style.display !== 'none') {
            document.getElementById('saveToCloud').click();
        }
    }
    
    // Alt + 1-5: Select analysis options
    if (e.altKey && ['1','2','3','4','5'].includes(e.key)) {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        const options = document.querySelectorAll('.option-btn:not(.highlight-option)');
        if (options[index]) {
            options[index].click();
        }
    }
    
    // ESC: Close dialogs
    if (e.key === 'Escape') {
        const confirmDialog = document.getElementById('analysisConfirmation');
        const shortcutsDialog = document.getElementById('keyboardShortcuts');
        
        if (confirmDialog && confirmDialog.style.display !== 'none') {
            confirmDialog.classList.remove('visible');
            setTimeout(() => {
                confirmDialog.style.display = 'none';
            }, 300);
        }
        
        if (shortcutsDialog && shortcutsDialog.style.display !== 'none') {
            shortcutsDialog.classList.remove('visible');
            setTimeout(() => {
                shortcutsDialog.style.display = 'none';
            }, 300);
        }
    }
    
    // ?: Show keyboard shortcuts
    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        const shortcutsDialog = document.getElementById('keyboardShortcuts');
        if (shortcutsDialog) {
            shortcutsDialog.style.display = 'flex';
            setTimeout(() => {
                shortcutsDialog.classList.add('visible');
            }, 10);
        }
    }
}

function initQuickActions() {
    const quickFullscreen = document.getElementById('quickFullscreen');
    
    if (quickFullscreen) {
        quickFullscreen.addEventListener('click', () => {
            toggleFullscreen('preview');
        });
    }
}

function toggleDarkMode() {
    darkMode = !darkMode;
    document.body.classList.toggle('dark-mode', darkMode);
    
    // Store preference
    localStorage.setItem('darkMode', darkMode ? 'true' : 'false');
    
    // Show feedback
    showToast(`Dark mode ${darkMode ? 'enabled' : 'disabled'}`, 'info');
}

// Save analysis to history
function saveAnalysisToHistory(analysisData) {
    // Add a unique ID if not present
    if (!analysisData.id) {
        analysisData.id = 'analysis-' + Date.now();
    }
    
    console.log('Saving analysis to history:', analysisData);
    
    // Get existing history from localStorage
    let analysisHistory = JSON.parse(localStorage.getItem('analysisHistory')) || [];
    
    // Add the new analysis at the beginning of the array
    analysisHistory.unshift(analysisData);
    
    // Limit the history to 10 items to prevent localStorage from getting too full
    if (analysisHistory.length > 10) {
        analysisHistory = analysisHistory.slice(0, 10);
    }
    
    // Save back to localStorage
    localStorage.setItem('analysisHistory', JSON.stringify(analysisHistory));
    
    // Update the history display
    updateHistoryDisplay();
    
    console.log('Analysis saved to history successfully');
}

// Initialize the PDF preview with the provided PDF document
window.renderPdfPreview = function(pdf, initialPage = 1) {
    console.log(`Initializing PDF preview: ${pdf.numPages} pages total`);
    
    // Store PDF state in window variables for access across functions
    window.pdfDocument = pdf;
    window.currentPdfPage = initialPage;
    
    // Render the initial page
    renderPdfPage(pdf, initialPage);
    
    // Enable or disable page navigation buttons based on current page
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    
    if (prevPageBtn) {
        prevPageBtn.disabled = initialPage <= 1;
    }
    
    if (nextPageBtn) {
        nextPageBtn.disabled = initialPage >= pdf.numPages;
    }
    
    // Update page info
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) {
        pageInfo.textContent = `Page ${initialPage} of ${pdf.numPages}`;
    }
};

// Function to toggle fullscreen for preview
function toggleFullscreen(previewType) {
    const previewContainer = document.getElementById('filePreview');
    const pdfPreview = document.getElementById('pdfPreview');
    const imagePreview = document.getElementById('imagePreview');
    
    // Get the specific element to toggle
    let targetElement;
    
    if (previewType === 'pdf') {
        targetElement = pdfPreview;
    } else if (previewType === 'image') {
        targetElement = imagePreview;
    } else {
        return;
    }
    
    // Check if already in fullscreen
    if (targetElement.classList.contains('fullscreen-preview')) {
        // Exit fullscreen mode
        targetElement.classList.remove('fullscreen-preview');
        previewContainer.classList.remove('has-fullscreen');
        
        // Update button text
        const fullscreenBtn = targetElement.querySelector('.fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                </svg>
                <span>Fullscreen</span>
            `;
        }
        
        // Scroll to the preview container
        previewContainer.scrollIntoView({ behavior: 'smooth' });
    } else {
        // Enter fullscreen mode
        targetElement.classList.add('fullscreen-preview');
        previewContainer.classList.add('has-fullscreen');
        
        // Update button text
        const fullscreenBtn = targetElement.querySelector('.fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
                </svg>
                <span>Exit Fullscreen</span>
            `;
        }
        
        // Scroll to the top of the fullscreen element
        targetElement.scrollIntoView({ behavior: 'smooth' });
    }
    
    // If it's a PDF preview, resize the canvas to fit the new container size
    if (previewType === 'pdf' && window.pdfDocument && window.currentPdfPage) {
        // Give a small delay to allow the transition to complete
        setTimeout(() => {
            renderPdfPage(window.pdfDocument, window.currentPdfPage);
        }, 300);
    }
}

// Initialize settings in the app
function initializeSettings() {
    // Create settings UI
    const settingsContainer = document.createElement('div');
    settingsContainer.className = 'settings-panel';
    settingsContainer.innerHTML = `
        <div class="settings-header">
            <h3>Settings</h3>
            <button class="close-btn settings-close">×</button>
        </div>
        <div class="settings-content">
            <div class="settings-section">
                <h4>Appearance</h4>
                <div class="setting-item">
                    <label for="darkModeToggle">Dark Mode</label>
                    <div class="toggle-switch">
                        <input type="checkbox" id="darkModeToggle">
                        <span class="toggle-slider"></span>
                    </div>
                </div>
                <div class="setting-item">
                    <label for="largeFontToggle">Larger Font Size</label>
                    <div class="toggle-switch">
                        <input type="checkbox" id="largeFontToggle">
                        <span class="toggle-slider"></span>
                    </div>
                </div>
            </div>
            
            <div class="settings-section">
                <h4>Preview Options</h4>
                <div class="setting-item">
                    <label for="previewSizeRange">Default Preview Size</label>
                    <input type="range" id="previewSizeRange" min="300" max="700" step="50" value="500">
                    <span id="previewSizeValue">500px</span>
                </div>
                <div class="setting-item">
                    <label for="pdfScaleRange">PDF Zoom Level</label>
                    <input type="range" id="pdfScaleRange" min="1" max="2" step="0.1" value="1.5">
                    <span id="pdfScaleValue">1.5x</span>
                </div>
            </div>
            
            <div class="settings-section">
                <h4>Document Analysis</h4>
                <div class="setting-item">
                    <label for="ocrToggleSettings">Enable OCR by default</label>
                    <div class="toggle-switch">
                        <input type="checkbox" id="ocrToggleSettings" checked>
                        <span class="toggle-slider"></span>
                    </div>
                </div>
                <div class="setting-item">
                    <label for="autoAnalyzeToggle">Auto-analyze after upload</label>
                    <div class="toggle-switch">
                        <input type="checkbox" id="autoAnalyzeToggle">
                        <span class="toggle-slider"></span>
                    </div>
                </div>
            </div>
        </div>
        <div class="settings-footer">
            <button id="resetSettings" class="action-btn">Reset to Defaults</button>
            <button id="saveSettings" class="action-btn">Save Changes</button>
        </div>
    `;
    
    document.body.appendChild(settingsContainer);
    
    // Create settings toggle button in the header
    const headerElement = document.querySelector('header');
    if (headerElement) {
        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'settings-toggle-btn';
        settingsBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
        `;
        headerElement.appendChild(settingsBtn);
        
        // Add click event listener to the settings button
        settingsBtn.addEventListener('click', toggleSettings);
    }
    
    // Load saved settings
    loadSettings();
    
    // Add event listeners
    document.querySelector('.settings-close').addEventListener('click', toggleSettings);
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
    document.getElementById('resetSettings').addEventListener('click', resetSettings);
    
    // Add event listeners for range inputs
    const previewSizeRange = document.getElementById('previewSizeRange');
    const previewSizeValue = document.getElementById('previewSizeValue');
    if (previewSizeRange && previewSizeValue) {
        previewSizeRange.addEventListener('input', function() {
            previewSizeValue.textContent = this.value + 'px';
            updatePreviewSize(this.value);
        });
    }
    
    const pdfScaleRange = document.getElementById('pdfScaleRange');
    const pdfScaleValue = document.getElementById('pdfScaleValue');
    if (pdfScaleRange && pdfScaleValue) {
        pdfScaleRange.addEventListener('input', function() {
            pdfScaleValue.textContent = this.value + 'x';
            updatePdfScale(this.value);
        });
    }
    
    // Add event listener for dark mode toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', function() {
            toggleDarkMode(this.checked);
        });
    }
    
    // Add event listener for font size toggle
    const largeFontToggle = document.getElementById('largeFontToggle');
    if (largeFontToggle) {
        largeFontToggle.addEventListener('change', function() {
            toggleLargeFont(this.checked);
        });
    }
    
    // Add event listener for OCR toggle
    const ocrToggleSettings = document.getElementById('ocrToggleSettings');
    const ocrToggle = document.getElementById('ocrToggle');
    if (ocrToggleSettings && ocrToggle) {
        ocrToggleSettings.addEventListener('change', function() {
            ocrToggle.checked = this.checked;
        });
        // Sync the two OCR toggles
        ocrToggle.addEventListener('change', function() {
            ocrToggleSettings.checked = this.checked;
        });
    }
}

// Function to toggle settings panel visibility
function toggleSettings() {
    const settingsPanel = document.querySelector('.settings-panel');
    if (settingsPanel) {
        settingsPanel.classList.toggle('visible');
    }
}

// Function to save settings
function saveSettings() {
    const settings = {
        darkMode: document.getElementById('darkModeToggle').checked,
        largeFont: document.getElementById('largeFontToggle').checked,
        previewSize: document.getElementById('previewSizeRange').value,
        pdfScale: document.getElementById('pdfScaleRange').value,
        ocrEnabled: document.getElementById('ocrToggleSettings').checked,
        autoAnalyze: document.getElementById('autoAnalyzeToggle').checked
    };
    
    // Save to localStorage
    localStorage.setItem('documentAnalyzerSettings', JSON.stringify(settings));
    
    // Apply settings
    applySettings(settings);
    
    // Show confirmation
    showToast('Settings saved successfully', 'success');
    
    // Close settings panel
    toggleSettings();
}

// Function to load settings
function loadSettings() {
    try {
        console.log('Loading saved settings...');
        
        // Get saved settings from localStorage
        const savedSettings = localStorage.getItem('documentAnalyzerSettings');
        if (!savedSettings) {
            console.log('No saved settings found, using defaults');
            return;
        }
        
        // Parse the saved settings
        const settings = JSON.parse(savedSettings);
        console.log('Found saved settings:', settings);
        
        // Apply the settings to the UI
        applySettings(settings);
        
        return settings;
    } catch (error) {
        console.error('Error loading settings:', error);
        // Don't throw the error, just use defaults
        return null;
    }
}

// Function to reset settings to defaults
function resetSettings() {
    const defaultSettings = {
        darkMode: false,
        largeFont: false,
        previewSize: 500,
        pdfScale: 1.5,
        ocrEnabled: true,
        autoAnalyze: false
    };
    
    // Update UI with default settings
    document.getElementById('darkModeToggle').checked = defaultSettings.darkMode;
    document.getElementById('largeFontToggle').checked = defaultSettings.largeFont;
    document.getElementById('previewSizeRange').value = defaultSettings.previewSize;
    document.getElementById('previewSizeValue').textContent = defaultSettings.previewSize + 'px';
    document.getElementById('pdfScaleRange').value = defaultSettings.pdfScale;
    document.getElementById('pdfScaleValue').textContent = defaultSettings.pdfScale + 'x';
    document.getElementById('ocrToggleSettings').checked = defaultSettings.ocrEnabled;
    document.getElementById('ocrToggle').checked = defaultSettings.ocrEnabled;
    document.getElementById('autoAnalyzeToggle').checked = defaultSettings.autoAnalyze;
    
    // Apply default settings
    applySettings(defaultSettings);
    
    // Show confirmation
    showToast('Settings reset to defaults', 'info');
}

// Function to apply settings
function applySettings(settings) {
    if (!settings) return;
    
    console.log('Applying settings to UI...');
    
    try {
        // Apply dark mode setting
        const darkModeEnabled = settings.darkMode || false;
        if (darkModeEnabled) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        
        // Apply large font setting
        const largeFontEnabled = settings.largeFont || false;
        if (largeFontEnabled) {
            document.body.classList.add('large-font');
        } else {
            document.body.classList.remove('large-font');
        }
        
        // Apply OCR toggle
        const ocrToggle = document.getElementById('ocrToggle');
        if (ocrToggle && 'ocrEnabled' in settings) {
            ocrToggle.checked = settings.ocrEnabled;
        }
        
        // Apply theme preference to the toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle && 'darkMode' in settings) {
            themeToggle.checked = settings.darkMode;
        }
        
        // Apply large font preference to the toggle
        const fontToggle = document.getElementById('fontSizeToggle');
        if (fontToggle && 'largeFont' in settings) {
            fontToggle.checked = settings.largeFont;
        }
        
        // Apply preview size
        const previewSizeControl = document.getElementById('previewSizeControl');
        if (previewSizeControl && 'previewSize' in settings) {
            previewSizeControl.value = settings.previewSize;
            updatePreviewSize(settings.previewSize);
        }
        
        // Apply PDF scale
        const pdfScaleControl = document.getElementById('pdfScaleControl');
        if (pdfScaleControl && 'pdfScale' in settings) {
            pdfScaleControl.value = settings.pdfScale;
            updatePdfScale(settings.pdfScale);
        }
        
        console.log('Settings applied successfully');
    } catch (error) {
        console.error('Error applying settings:', error);
        // Continue execution even if there's an error
    }
}

// Toggle dark mode
function toggleDarkMode(enabled) {
    if (enabled) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

// Toggle large font
function toggleLargeFont(enabled) {
    if (enabled) {
        document.body.classList.add('large-font');
    } else {
        document.body.classList.remove('large-font');
    }
}

// Update preview size
function updatePreviewSize(size) {
    const previewContent = document.querySelector('.preview-content');
    if (previewContent) {
        previewContent.style.height = `${size}px`;
    }
    
    // If a PDF is currently being viewed, redraw it to fit the new size
    if (window.pdfDocument && window.currentPdfPage) {
        setTimeout(() => {
            renderPdfPage(window.pdfDocument, window.currentPdfPage);
        }, 50);
    }
}

// Update PDF scale
function updatePdfScale(scale) {
    window.pdfScale = parseFloat(scale);
    
    // If a PDF is currently being viewed, redraw it with the new scale
    if (window.pdfDocument && window.currentPdfPage) {
        setTimeout(() => {
            renderPdfPage(window.pdfDocument, window.currentPdfPage);
        }, 50);
    }
}

// Setup file upload event listeners
function setupFileUploadEvents() {
    // Initialize drag and drop functionality
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    
    // Ensure we have the required elements
    if (!dropArea || !fileInput || !browseBtn) {
        console.error('Required elements not found for file upload');
        return;
    }
    
    // Handle file input change
    fileInput.addEventListener('change', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('File input change detected');
        if (this.files && this.files.length > 0) {
            console.log('Files selected:', this.files[0].name);
            handleFiles(this.files);
            // Reset the file input so the same file can be selected again
            this.value = '';
        }
    });
    
    // Handle browse button click
    browseBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Browse button clicked');
        fileInput.click();
    });
    
    // Handle drag and drop events
    dropArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.add('drag-over');
    });
    
    dropArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('drag-over');
    });
    
    dropArea.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            console.log('Files dropped:', files[0].name);
            handleFiles(files);
        }
    });
    
    // Handle drop area click (excluding buttons)
    dropArea.addEventListener('click', function(e) {
        // Don't trigger if we're clicking on a button or link inside the drop area
        if (e.target.closest('.upload-btn') || e.target.closest('button') || e.target.closest('a')) {
            return;
        }
        
        console.log('Drop area clicked');
        fileInput.click();
    });
}

// Setup UI elements and interactions
function setupUIElements() {
    // Log available UI elements for debugging
    console.log('Setting up UI elements');
    
    const startAnalysisBtn = document.getElementById('startAnalysisBtn');
    if (startAnalysisBtn) {
        console.log('Found start analysis button');
    } else {
        console.warn('Start analysis button not found');
    }
    
    // Update copyright year
    const currentYear = new Date().getFullYear();
    const copyrightEl = document.getElementById('copyrightText');
    if (copyrightEl) {
        copyrightEl.textContent = `© 2025 Mithun. All Rights Reserved.`;
    }
}

// Setup validation for required fields
function setupValidation() {
    // Example validation for custom prompt
    const customPrompt = document.getElementById('customPrompt');
    const startAnalysisBtn = document.getElementById('startAnalysisBtn');
    
    if (customPrompt && startAnalysisBtn) {
        customPrompt.addEventListener('input', function() {
            if (isCustomPrompt && this.value.trim() === '') {
                startAnalysisBtn.setAttribute('disabled', 'disabled');
                startAnalysisBtn.title = 'Please enter a custom prompt';
            } else {
                startAnalysisBtn.removeAttribute('disabled');
                startAnalysisBtn.title = '';
            }
        });
        console.log('Custom prompt validation initialized');
    }
}

// Setup action buttons for Copy, Download, Share, Save in results
function setupResultActionButtons() {
    console.log('Setting up result action buttons');
    
    // Copy results button
    const copyResultsBtn = document.getElementById('copyResults');
    if (copyResultsBtn) {
        copyResultsBtn.addEventListener('click', () => {
            const resultsContent = document.getElementById('resultsContent');
            if (resultsContent) {
                // Create a range and select the content
                const range = document.createRange();
                range.selectNode(resultsContent);
                window.getSelection().removeAllRanges();
                window.getSelection().addRange(range);
                
                // Execute copy command
                try {
                    document.execCommand('copy');
                    window.getSelection().removeAllRanges();
                    showToast('Results copied to clipboard', 'success');
                } catch (err) {
                    console.error('Failed to copy text: ', err);
                    showToast('Failed to copy text', 'error');
                }
            }
        });
    }
    
    // Download results button
    const downloadResultsBtn = document.getElementById('downloadResults');
    if (downloadResultsBtn) {
        downloadResultsBtn.addEventListener('click', () => {
            const resultsContent = document.getElementById('resultsContent');
            if (resultsContent && window.analysisResults) {
                try {
                    // Create a blob with the text content
                    const blob = new Blob([window.analysisResults], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    
                    // Create a temporary anchor and trigger download
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `analysis-${new Date().toISOString().split('T')[0]}.txt`;
                    document.body.appendChild(a);
                    a.click();
                    
                    // Clean up
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    showToast('Results downloaded', 'success');
                } catch (err) {
                    console.error('Failed to download results: ', err);
                    showToast('Failed to download results', 'error');
                }
            }
        });
    }
    
    // Share results button
    const shareResultsBtn = document.getElementById('shareResults');
    if (shareResultsBtn) {
        shareResultsBtn.addEventListener('click', () => {
            if (window.analysisResults && navigator.share) {
                // Use Web Share API if available
                navigator.share({
                    title: 'Document Analysis Results',
                    text: window.analysisResults.substring(0, 5000) // Limit text length for sharing
                })
                .then(() => showToast('Shared successfully', 'success'))
                .catch(err => {
                    console.error('Error sharing: ', err);
                    showToast('Unable to share results', 'error');
                });
            } else {
                // Fallback for browsers without Web Share API
                const resultsUrl = window.location.href;
                
                // Create a temporary input to copy the URL
                const input = document.createElement('input');
                input.value = resultsUrl;
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                document.body.removeChild(input);
                
                showToast('URL copied to clipboard. You can now share it manually.', 'info');
            }
        });
    }
    
    // Save to cloud/history button
    const saveToCloudBtn = document.getElementById('saveToCloud');
    if (saveToCloudBtn) {
        saveToCloudBtn.addEventListener('click', () => {
            if (window.analysisResults && currentFile) {
                saveAnalysisToHistory({
                    documentName: currentFile.name || 'Document',
                    analysisType: currentAnalysisOption || 'analysis',
                    timestamp: new Date().toISOString(),
                    results: window.analysisResults,
                    id: 'analysis-' + Date.now()
                });
                
                updateHistoryDisplay();
                showToast('Analysis saved to history', 'success');
            } else {
                showToast('No analysis results to save', 'error');
            }
        });
    }
}

// Add text-to-speech and translation functionality
function initTextToSpeechAndTranslation() {
    // Create the text-to-speech and translation section
    const resultsSection = document.querySelector('.results-section');
    const resultsContent = document.getElementById('resultsContent');
    
    if (!resultsSection || !resultsContent) {
        console.error('Results section not found');
        return;
    }
    
    // Create a new container for TTS and translation
    const advancedToolsContainer = document.createElement('div');
    advancedToolsContainer.className = 'advanced-tools-container';
    advancedToolsContainer.innerHTML = `
        <div class="advanced-tools-header">
            <h3>Text-to-Speech & Translation</h3>
        </div>
        <div class="advanced-tools-content">
            <div class="tts-container">
                <h4>Text-to-Speech</h4>
                <div class="tts-controls">
                    <select id="ttsVoiceSelect" class="voice-select">
                        <option value="">Select a voice</option>
                    </select>
                    <div class="tts-buttons">
                        <button id="ttsPlayBtn" class="tts-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                            Play
                        </button>
                        <button id="ttsPauseBtn" class="tts-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="6" y="4" width="4" height="16"></rect>
                                <rect x="14" y="4" width="4" height="16"></rect>
                            </svg>
                            Pause
                        </button>
                        <button id="ttsStopBtn" class="tts-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            </svg>
                            Stop
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="translation-container">
                <h4>Translation</h4>
                <div class="translation-controls">
                    <select id="translationLanguage" class="language-select">
                        <option value="">Select a language</option>
                        <!-- Indian Languages -->
                        <option value="hi">Hindi (हिन्दी)</option>
                        <option value="bn">Bengali (বাংলা)</option>
                        <option value="te">Telugu (తెలుగు)</option>
                        <option value="mr">Marathi (मराठी)</option>
                        <option value="ta">Tamil (தமிழ்)</option>
                        <option value="ur">Urdu (اردو)</option>
                        <option value="gu">Gujarati (ગુજરાતી)</option>
                        <option value="kn">Kannada (ಕನ್ನಡ)</option>
                        <option value="ml">Malayalam (മലയാളം)</option>
                        <option value="pa">Punjabi (ਪੰਜਾਬੀ)</option>
                        <!-- Other Asian Languages -->
                        <option value="zh">Chinese (中文)</option>
                        <option value="ja">Japanese (日本語)</option>
                        <option value="ko">Korean (한국어)</option>
                        <option value="th">Thai (ไทย)</option>
                        <option value="vi">Vietnamese (Tiếng Việt)</option>
                        <!-- European Languages -->
                        <option value="fr">French (Français)</option>
                        <option value="de">German (Deutsch)</option>
                        <option value="es">Spanish (Español)</option>
                        <option value="it">Italian (Italiano)</option>
                        <option value="pt">Portuguese (Português)</option>
                        <option value="ru">Russian (Русский)</option>
                        <option value="nl">Dutch (Nederlands)</option>
                        <option value="sv">Swedish (Svenska)</option>
                        <option value="pl">Polish (Polski)</option>
                        <option value="tr">Turkish (Türkçe)</option>
                        <!-- Middle Eastern Languages -->
                        <option value="ar">Arabic (العربية)</option>
                        <option value="he">Hebrew (עִבְרִית)</option>
                        <option value="fa">Persian (فارسی)</option>
                        <!-- African Languages -->
                        <option value="sw">Swahili (Kiswahili)</option>
                        <option value="am">Amharic (አማርኛ)</option>
                        <option value="ha">Hausa (Hausa)</option>
                        <!-- Other languages can be added here -->
                    </select>
                    <button id="translateBtn" class="translate-btn">Translate</button>
                </div>
                <div id="translationResult" class="translation-result"></div>
            </div>
        </div>
    `;
    
    // Insert after results-content
    resultsContent.parentNode.insertBefore(advancedToolsContainer, resultsContent.nextSibling);
    
    // Initialize text-to-speech functionality
    initTextToSpeech();
    
    // Initialize translation functionality
    initTranslation();
}

// Text-to-speech implementation
function initTextToSpeech() {
    // Get TTS elements
    const ttsVoiceSelect = document.getElementById('ttsVoiceSelect');
    const ttsPlayBtn = document.getElementById('ttsPlayBtn');
    const ttsPauseBtn = document.getElementById('ttsPauseBtn');
    const ttsStopBtn = document.getElementById('ttsStopBtn');
    const resultsContent = document.getElementById('resultsContent');
    
    if (!ttsVoiceSelect || !ttsPlayBtn || !ttsPauseBtn || !ttsStopBtn || !resultsContent) {
        console.error('TTS elements not found');
        return;
    }
    
    // Speech synthesis variables
    let speech = null;
    let voices = [];
    
    // Check if browser supports speech synthesis
    if ('speechSynthesis' in window) {
        // Get available voices
        speech = window.speechSynthesis;
        
        // Force voice loading and population
        function loadVoices() {
            // Get all available voices
            voices = speech.getVoices();
            
            // Log available voices for debugging
            console.log('Available voices:', voices.length);
            
            // Clear existing options
            ttsVoiceSelect.innerHTML = '<option value="">Select a voice</option>';
            
            // If no voices are available yet, try again in a moment
            if (voices.length === 0) {
                setTimeout(loadVoices, 100);
                return;
            }
            
            // Add available voices
            voices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.name;
                option.textContent = `${voice.name} (${voice.lang})`;
                option.setAttribute('data-lang', voice.lang);
                ttsVoiceSelect.appendChild(option);
            });
            
            // If we found voices, notify the user
            if (voices.length > 0) {
                console.log('Loaded', voices.length, 'voices');
                showToast(`Loaded ${voices.length} text-to-speech voices`, 'info');
            } else {
                console.error('No voices available for speech synthesis');
                showToast('No voices available for text-to-speech', 'error');
            }
        }
        
        // Initial loading - both methods to support different browsers
        loadVoices();
        
        // Chrome loads voices asynchronously
        if (speech.onvoiceschanged !== undefined) {
            speech.onvoiceschanged = loadVoices;
        }
        
        // Play button handler
        ttsPlayBtn.addEventListener('click', () => {
            if (speech.paused) {
                speech.resume();
            } else {
                const text = resultsContent.textContent || '';
                if (text.trim() === '') {
                    showToast('No text to speak', 'error');
                    return;
                }
                
                const utterance = new SpeechSynthesisUtterance(text);
                const selectedVoice = ttsVoiceSelect.value;
                
                if (selectedVoice) {
                    utterance.voice = voices.find(voice => voice.name === selectedVoice);
                }
                
                speech.speak(utterance);
                showToast('Text-to-speech started', 'info');
            }
        });
        
        // Pause button handler
        ttsPauseBtn.addEventListener('click', () => {
            if (speech.speaking && !speech.paused) {
                speech.pause();
                showToast('Text-to-speech paused', 'info');
            }
        });
        
        // Stop button handler
        ttsStopBtn.addEventListener('click', () => {
            if (speech.speaking) {
                speech.cancel();
                showToast('Text-to-speech stopped', 'info');
            }
        });
    } else {
        // Hide TTS if not supported
        const ttsContainer = document.querySelector('.tts-container');
        if (ttsContainer) {
            ttsContainer.innerHTML = '<p>Text-to-speech is not supported in your browser.</p>';
        }
    }
}

// Translation implementation
function initTranslation() {
    const translateBtn = document.getElementById('translateBtn');
    const translationLanguage = document.getElementById('translationLanguage');
    const translationResult = document.getElementById('translationResult');
    const resultsContent = document.getElementById('resultsContent');
    
    if (!translateBtn || !translationLanguage || !translationResult || !resultsContent) {
        console.error('Translation elements not found');
        return;
    }
    
    // Speech synthesis for translations
    let speech = null;
    let voices = [];
    
    // Check if browser supports speech synthesis
    if ('speechSynthesis' in window) {
        speech = window.speechSynthesis;
        
        // Force voice loading
        function loadVoices() {
            voices = speech.getVoices();
            console.log('Translation voices loaded:', voices.length);
            
            // Group voices by language
            const voicesByLang = {};
            voices.forEach(voice => {
                const lang = voice.lang.split('-')[0]; // Get main language code (e.g., 'en' from 'en-US')
                if (!voicesByLang[lang]) {
                    voicesByLang[lang] = [];
                }
                voicesByLang[lang].push(voice);
            });
            
            console.log('Voices by language:', Object.keys(voicesByLang));
        }
        
        // Initial loading
        loadVoices();
        
        // Chrome loads voices asynchronously
        if (speech.onvoiceschanged !== undefined) {
            speech.onvoiceschanged = loadVoices;
        }
    }
    
    // Mock translation function (simulated for demo purposes)
    translateBtn.addEventListener('click', () => {
        const text = resultsContent.textContent || '';
        const language = translationLanguage.value;
        
        if (!language) {
            showToast('Please select a language', 'error');
            return;
        }
        
        if (text.trim() === '') {
            showToast('No text to translate', 'error');
            return;
        }
        
        // Show loading indicator
        translationResult.innerHTML = '<div class="translation-loading">Translating...</div>';
        
        // Simulate translation delay
        setTimeout(() => {
            // This is a mock translation - in a real app, you would call a translation API
            const languageName = translationLanguage.options[translationLanguage.selectedIndex].text;
            const translatedText = simulateTranslation(text, language);
            
            // Create speak button for the translation
            const speakTranslationBtn = document.createElement('button');
            speakTranslationBtn.className = 'translation-speak-btn';
            speakTranslationBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
                Speak
            `;
            
            // Add click handler to speak the translation
            speakTranslationBtn.addEventListener('click', () => {
                if (!speech) {
                    showToast('Text-to-speech is not supported in your browser', 'error');
                    return;
                }
                
                // Stop any ongoing speech
                if (speech.speaking) {
                    speech.cancel();
                }
                
                // Create a new utterance for the translation
                const utterance = new SpeechSynthesisUtterance(translatedText);
                
                // Try to find a voice for the selected language
                const langCode = language.split('-')[0]; // Get the main language code
                
                // First try to find a voice that exactly matches the language
                let matchingVoices = voices.filter(voice => 
                    voice.lang.toLowerCase().startsWith(langCode.toLowerCase())
                );
                
                // If no exact match, try to find any voice from the same language family
                if (matchingVoices.length === 0) {
                    // For Indian languages, try to find any Indian voice as fallback
                    const indianLanguages = ['hi', 'bn', 'te', 'mr', 'ta', 'ur', 'gu', 'kn', 'ml', 'pa'];
                    if (indianLanguages.includes(langCode)) {
                        // Try Hindi as fallback for Indian languages
                        matchingVoices = voices.filter(voice => 
                            voice.lang.toLowerCase().startsWith('hi')
                        );
                    }
                }
                
                if (matchingVoices.length > 0) {
                    // Use the first matching voice
                    utterance.voice = matchingVoices[0];
                    console.log(`Using voice: ${utterance.voice.name} (${utterance.voice.lang})`);
                } else {
                    console.log(`No matching voice found for ${language}, using default voice`);
                }
                
                // Set language regardless of voice match
                utterance.lang = language;
                
                // Speak the translation
                speech.speak(utterance);
                showToast(`Speaking translation in ${languageName}`, 'info');
            });
            
            translationResult.innerHTML = `
                <div class="translation-header">
                    <h5>Translated to ${languageName}</h5>
                    <div class="translation-actions"></div>
                </div>
                <div class="translation-text">${translatedText}</div>
            `;
            
            // Add speak button to the translation header
            const translationActions = translationResult.querySelector('.translation-actions');
            if (translationActions) {
                translationActions.appendChild(speakTranslationBtn);
            }
            
            showToast(`Text translated to ${languageName}`, 'success');
        }, 1500);
    });
}

// Function to simulate translation (for demo purposes)
function simulateTranslation(text, language) {
    // In a real application, you would call a translation API here
    // For this demo, we'll just create a mock translated text
    
    // Get the first 100 characters as a sample
    const sampleText = text.substring(0, Math.min(text.length, 100));
    
    // Create different patterns for different language groups
    const langPatterns = {
        // Indian languages
        'hi': ['नमस्ते', 'धन्यवाद', 'स्वागत है', 'अच्छा', 'महत्वपूर्ण'],
        'bn': ['নমস্কার', 'ধন্যবাদ', 'স্বাগতম', 'ভালো', 'গুরুত্বপূর্ণ'],
        'te': ['నమస్కారం', 'ధన్యవాదాలు', 'స్వాగతం', 'మంచి', 'ముఖ్యమైన'],
        'ta': ['வணக்கம்', 'நன்றி', 'வரவேற்பு', 'நல்ல', 'முக்கியமான'],
        
        // European languages
        'fr': ['Bonjour', 'Merci', 'Bienvenue', 'Bon', 'Important'],
        'de': ['Hallo', 'Danke', 'Willkommen', 'Gut', 'Wichtig'],
        'es': ['Hola', 'Gracias', 'Bienvenido', 'Bueno', 'Importante'],
        
        // East Asian languages
        'zh': ['你好', '谢谢', '欢迎', '好', '重要'],
        'ja': ['こんにちは', 'ありがとう', 'ようこそ', '良い', '重要'],
        'ko': ['안녕하세요', '감사합니다', '환영합니다', '좋은', '중요한']
    };
    
    // Default pattern for languages not in our map
    const defaultPattern = ['Lorem', 'Ipsum', 'Dolor', 'Sit', 'Amet'];
    
    // Get the pattern for the selected language or use default
    const pattern = langPatterns[language] || defaultPattern;
    
    // Create a "translated" version by replacing some words and keeping structure
    const words = text.split(/\s+/);
    let translatedText = '';
    
    for (let i = 0; i < words.length; i++) {
        if (i % 5 === 0 && i < words.length) {
            translatedText += pattern[i % pattern.length] + ' ';
        } else if (i % 7 === 0) {
            translatedText += pattern[(i+1) % pattern.length] + ' ';
        } else {
            // Keep some words as-is to simulate partial translation
            translatedText += words[i] + ' ';
        }
        
        // Add line breaks to maintain readability
        if (i % 15 === 14) {
            translatedText += '<br>';
        }
    }
    
    return translatedText;
}
}
