/**
 * Integration Module for PDF Analyzer
 * 
 * This module connects the core PDF Analyzer functionality with:
 * 1. Agentverse integration for agent registration
 * 2. Advanced features for enhanced functionality
 */

// Wait for document and all dependencies to load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing PDF Analyzer integration...');
    
    // Initialize UI event listeners for advanced features
    initializeAdvancedFeatureHandlers();
    
    // Connect agentBus to Agentverse
    connectAgentBusToAgentverse();
});

/**
 * Initialize handlers for the advanced feature buttons
 */
function initializeAdvancedFeatureHandlers() {
    // Get buttons from the DOM
    const compareDocumentsBtn = document.getElementById('compareDocuments');
    const createKnowledgeGraphBtn = document.getElementById('createKnowledgeGraph');
    const generatePresentationBtn = document.getElementById('generatePresentation');
    const extractCitationsBtn = document.getElementById('extractCitations');
    const advancedToggleBtn = document.getElementById('advancedToggle');
    const advancedContent = document.querySelector('.advanced-content');
    
    // Toggle advanced features visibility
    if (advancedToggleBtn && advancedContent) {
        advancedToggleBtn.addEventListener('click', () => {
            const isVisible = advancedContent.style.display !== 'none';
            advancedContent.style.display = isVisible ? 'none' : 'block';
            advancedToggleBtn.classList.toggle('active', !isVisible);
        });
    }
    
    // Document comparison feature
    if (compareDocumentsBtn) {
        compareDocumentsBtn.addEventListener('click', () => {
            if (!window.documentCollection || window.documentCollection.length < 2) {
                showToast('Please upload at least two documents to compare', 'error');
                return;
            }
            
            try {
                // Call advanced feature
                const results = window.AdvancedFeatures.compareDocuments(window.documentCollection);
                
                // Format results for display
                const formattedResults = formatComparisonResults(results);
                
                // Display in results area
                displayResultsContent(formattedResults);
                showToast('Document comparison complete', 'success');
            } catch (error) {
                console.error('Error comparing documents:', error);
                showToast('Error comparing documents', 'error');
            }
        });
    }
    
    // Knowledge Graph feature
    if (createKnowledgeGraphBtn) {
        createKnowledgeGraphBtn.addEventListener('click', () => {
            if (!window.extractedEntities || Object.keys(window.extractedEntities).length === 0) {
                showToast('Please analyze a document with entity extraction first', 'error');
                return;
            }
            
            try {
                // Call advanced feature
                const knowledgeGraph = window.AdvancedFeatures.generateKnowledgeGraph(window.extractedEntities);
                
                // Format results for display
                const formattedResults = formatKnowledgeGraph(knowledgeGraph);
                
                // Display in results area
                displayResultsContent(formattedResults);
                showToast('Knowledge graph generated', 'success');
            } catch (error) {
                console.error('Error generating knowledge graph:', error);
                showToast('Error generating knowledge graph', 'error');
            }
        });
    }
    
    // Presentation generation feature
    if (generatePresentationBtn) {
        generatePresentationBtn.addEventListener('click', () => {
            if (!window.analysisResults) {
                showToast('Please analyze a document first', 'error');
                return;
            }
            
            try {
                // Call advanced feature
                const presentation = window.AdvancedFeatures.generatePresentation(
                    window.analysisResults, 
                    window.pdfName || 'Document'
                );
                
                // Format results for display
                const formattedResults = formatPresentation(presentation);
                
                // Display in results area
                displayResultsContent(formattedResults);
                showToast('Presentation generated', 'success');
            } catch (error) {
                console.error('Error generating presentation:', error);
                showToast('Error generating presentation', 'error');
            }
        });
    }
    
    // Citation extraction feature
    if (extractCitationsBtn) {
        extractCitationsBtn.addEventListener('click', () => {
            if (!window.pdfText) {
                showToast('Please upload a document first', 'error');
                return;
            }
            
            try {
                // Call advanced feature
                const citations = window.AdvancedFeatures.extractCitations(window.pdfText);
                
                // Format results for display
                const formattedResults = formatCitations(citations);
                
                // Display in results area
                displayResultsContent(formattedResults);
                showToast(`Extracted ${citations.length} citations`, 'success');
            } catch (error) {
                console.error('Error extracting citations:', error);
                showToast('Error extracting citations', 'error');
            }
        });
    }
}

/**
 * Connect the agentBus to Agentverse for messaging
 */
function connectAgentBusToAgentverse() {
    // Check if agentBus and agentverseIntegration are available
    if (!window.agentBus || !window.agentverseIntegration) {
        console.error('Agent bus or Agentverse integration not available');
        return;
    }
    
    // Create a message adapter
    const adapter = window.agentverseIntegration.createMessageAdapter();
    
    // Extend agentBus with Agentverse capabilities
    const originalPublish = window.agentBus.publish;
    
    // Override the publish method to also send to Agentverse
    window.agentBus.publish = function(sender, type, payload) {
        // Call the original method first
        const message = originalPublish.call(this, sender, type, payload);
        
        // Then send to Agentverse if we're connected
        if (window.AGENT_SYSTEM && window.AGENT_SYSTEM.registered) {
            adapter.sendToAgentverse(message)
                .then(response => {
                    console.log('Message sent to Agentverse:', response);
                })
                .catch(error => {
                    console.error('Error sending message to Agentverse:', error);
                });
        }
        
        return message;
    };
    
    console.log('Agent bus connected to Agentverse');
}

/**
 * Helper function to format comparison results for display
 */
function formatComparisonResults(results) {
    return `# Document Comparison Results

## Overview
Compared **${results.documentCount} documents** with a total of **${results.totalPages} pages**.
Overall similarity: **${results.similarity}%**

## Similarities
${results.similarities.map(s => `* ${s}`).join('\n')}

## Differences
${results.differences.map(d => `* ${d}`).join('\n')}

## Common Entities
${results.commonEntities.map(e => `* ${e}`).join('\n')}

## Unique Entities by Document
${Object.entries(results.uniqueEntities).map(([docId, entities]) => 
    `### ${docId}\n${entities.map(e => `* ${e}`).join('\n')}`
).join('\n\n')}`;
}

/**
 * Helper function to format knowledge graph for display
 */
function formatKnowledgeGraph(graph) {
    return `# Knowledge Graph Generated

## Overview
* **${graph.nodes.length} entities** identified
* **${graph.edges.length} relationships** detected
* **${graph.metadata.categories.length} categories** of information

## Entity Categories
${graph.metadata.categories.map(c => `* **${c}**: ${graph.nodes.filter(n => n.category === c).length} entities`).join('\n')}

## Key Entities
${graph.nodes.slice(0, 10).map(n => `* **${n.label}** (${n.category})`).join('\n')}

## Major Relationships
${graph.edges.slice(0, 10).map(e => {
    const source = graph.nodes.find(n => n.id === e.source);
    const target = graph.nodes.find(n => n.id === e.target);
    return `* **${source?.label || 'Entity'}** ${e.label} **${target?.label || 'Entity'}**`;
}).join('\n')}

*Note: A visual representation of the knowledge graph would typically be displayed here using a visualization library.*`;
}

/**
 * Helper function to format presentation for display
 */
function formatPresentation(presentation) {
    return `# Presentation Generated: ${presentation.title}

## Overview
* **${presentation.totalSlides} slides** generated
* Format: **${presentation.format}**

## Slide Structure
${presentation.slides.map((slide, index) => 
    `### Slide ${index + 1}: ${slide.title}
* Type: ${slide.type}
${slide.bulletPoints ? slide.bulletPoints.map(b => `* ${b}`).join('\n') : ''}
${slide.hasChart ? `* Includes ${slide.chartType} chart` : ''}`
).join('\n\n')}

*Note: In a complete implementation, this would generate an actual downloadable presentation file.*`;
}

/**
 * Helper function to format citations for display
 */
function formatCitations(citations) {
    return `# Extracted Citations

${citations.length > 0 
    ? `## ${citations.length} Citations Found\n\n${citations.map(c => 
        `${c.id}. **${c.text}** (${c.type})`
    ).join('\n\n')}`
    : '## No citations found in document'}

*Note: Citations can be exported in various formats (APA, MLA, Chicago, etc.)*`;
}

/**
 * Helper function to display content in the results area
 */
function displayResultsContent(content) {
    const resultsContent = document.getElementById('resultsContent');
    const resultsSection = document.querySelector('.results-section');
    
    if (resultsContent && resultsSection) {
        // Format markdown text
        const formattedContent = formatMarkdown(content);
        
        // Display results
        resultsContent.innerHTML = formattedContent;
        resultsSection.style.display = 'block';
        
        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 * Helper function to show toast notification
 */
function showToast(message, type = 'success') {
    // Check if it exists in the global scope
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        // Fallback implementation
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }
}

/**
 * Format markdown text to HTML
 */
function formatMarkdown(text) {
    // Check if it exists in the global scope
    if (typeof window.formatMarkdown === 'function') {
        return window.formatMarkdown(text);
    }
    
    // Simple fallback implementation
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^\*]*)\*/g, '<em>$1</em>')
        .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
        .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
        .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
        .replace(/^\* (.*?)$/gm, '<li>$1</li>')
        .replace(/^- (.*?)$/gm, '<li>$1</li>')
        .replace(/(<li>.*?<\/li>\n)+/g, '<ul>$&</ul>')
        .replace(/\n/g, '<br>');
} 