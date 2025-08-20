/**
 * Semantic Document Decomposition Engine
 * Breaks down complex documents into reusable semantic objects and relationships
 */

export class SemanticDocumentEngine {
  constructor() {
    // Define semantic object types and their extraction patterns
    this.objectTypes = {
      contact: {
        patterns: {
          email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
          phone: /(?:\+1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
          name: /(?:contact|name|from|to|attention)[\s:]+([A-Z][a-z]+\s+[A-Z][a-z]+)/gi,
          address: /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)[\s,]+[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}/gi
        },
        confidence: 0.85
      },
      
      financial: {
        patterns: {
          invoice_number: /(?:invoice|inv)[\s#:]+(\w+\d+)/gi,
          amount: /\$[\d,]+\.?\d*/g,
          account_number: /(?:account|acct)[\s#:]+(\d{8,})/gi,
          tax_id: /(?:tax\s+id|ein)[\s:]+(\d{2}-?\d{7})/gi,
          due_date: /(?:due|payment\s+due)[\s:]+(\d{1,2}\/\d{1,2}\/\d{4})/gi
        },
        confidence: 0.9
      },
      
      product: {
        patterns: {
          sku: /(?:sku|product\s+id|item)[\s#:]+([A-Z0-9-]+)/gi,
          price: /(?:price|cost)[\s:$]+(\d+\.?\d*)/gi,
          quantity: /(?:qty|quantity)[\s:]+(\d+)/gi,
          description: /(?:description|product)[\s:]+([A-Za-z0-9\s]{10,100})/gi,
          category: /(?:category|type)[\s:]+([A-Za-z\s]+)/gi
        },
        confidence: 0.8
      },
      
      organization: {
        patterns: {
          company_name: /(?:company|corporation|corp|inc|ltd|llc)[\s:]*([A-Z][A-Za-z\s&]+(?:Inc|Corp|LLC|Ltd)?)/gi,
          website: /(?:www\.|https?:\/\/)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
          business_license: /(?:license|permit)[\s#:]+([A-Z0-9-]+)/gi
        },
        confidence: 0.75
      },
      
      date_event: {
        patterns: {
          meeting_date: /(?:meeting|appointment|scheduled)[\s:]+(\d{1,2}\/\d{1,2}\/\d{4})/gi,
          deadline: /(?:deadline|due\s+by|expires?)[\s:]+(\d{1,2}\/\d{1,2}\/\d{4})/gi,
          event_time: /(?:at|time)[\s:]+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/gi
        },
        confidence: 0.7
      },
      
      asset: {
        patterns: {
          logo_reference: /(?:logo|brand|trademark)/gi,
          image_reference: /(?:image|photo|picture|graphic)/gi,
          document_reference: /(?:attached|see\s+attachment|reference)/gi
        },
        confidence: 0.6
      }
    };

    // Relationship patterns between objects
    this.relationshipPatterns = {
      'contact-to-organization': [
        /([A-Z][a-z]+\s+[A-Z][a-z]+).*(?:at|from|with)\s+([A-Z][A-Za-z\s&]+)/gi,
        /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}).*([A-Z][A-Za-z\s&]+(?:Inc|Corp|LLC|Ltd))/gi
      ],
      'product-to-financial': [
        /([A-Z0-9-]+).*\$(\d+\.?\d*)/g,
        /(?:sku|item)[\s:]+([A-Z0-9-]+).*(?:price|cost)[\s:$]+(\d+\.?\d*)/gi
      ],
      'contact-to-financial': [
        /(?:bill\s+to|invoice\s+to)[\s:]*([A-Z][a-z]+\s+[A-Z][a-z]+)/gi,
        /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}).*(?:invoice|payment)/gi
      ]
    };
  }

  /**
   * Main decomposition method - breaks document into semantic objects
   */
  async decomposeDocument(documentText, documentMetadata = {}) {
    console.log('🔍 Starting semantic decomposition...');
    
    const decomposition = {
      document_id: documentMetadata.id || this.generateId(),
      source_document: documentMetadata.filename || 'unknown',
      extracted_objects: {},
      relationships: [],
      reusable_assets: [],
      confidence_scores: {},
      processing_timestamp: new Date().toISOString()
    };

    // Extract semantic objects
    for (const [objectType, config] of Object.entries(this.objectTypes)) {
      decomposition.extracted_objects[objectType] = await this.extractObjectType(
        documentText, 
        objectType, 
        config
      );
    }

    // Find relationships between objects
    decomposition.relationships = await this.extractRelationships(
      documentText, 
      decomposition.extracted_objects
    );

    // Identify reusable assets
    decomposition.reusable_assets = await this.identifyReusableAssets(
      decomposition.extracted_objects
    );

    // Calculate overall confidence
    decomposition.overall_confidence = this.calculateOverallConfidence(
      decomposition.extracted_objects
    );

    console.log('✅ Semantic decomposition complete:', decomposition);
    return decomposition;
  }

  /**
   * Extract specific object types from text
   */
  async extractObjectType(text, objectType, config) {
    const extracted = {
      type: objectType,
      instances: [],
      confidence: config.confidence,
      extraction_method: 'pattern_matching'
    };

    for (const [fieldName, pattern] of Object.entries(config.patterns)) {
      const matches = [...text.matchAll(pattern)];
      
      matches.forEach((match, index) => {
        const instance = {
          id: `${objectType}_${fieldName}_${index}`,
          field: fieldName,
          value: match[1] || match[0],
          raw_match: match[0],
          position: match.index,
          context: this.getContext(text, match.index, 50),
          confidence: config.confidence
        };

        extracted.instances.push(instance);
      });
    }

    // Post-process and validate instances
    extracted.instances = this.validateAndEnrichInstances(extracted.instances, objectType);
    
    return extracted;
  }

  /**
   * Find relationships between extracted objects
   */
  async extractRelationships(text, extractedObjects) {
    const relationships = [];

    for (const [relationshipType, patterns] of Object.entries(this.relationshipPatterns)) {
      const [sourceType, targetType] = relationshipType.split('-to-');
      
      for (const pattern of patterns) {
        const matches = [...text.matchAll(pattern)];
        
        matches.forEach(match => {
          const relationship = {
            id: this.generateId(),
            type: relationshipType,
            source_type: sourceType,
            target_type: targetType,
            source_value: match[1],
            target_value: match[2],
            context: this.getContext(text, match.index, 100),
            confidence: 0.8,
            extraction_method: 'pattern_relationship'
          };
          
          relationships.push(relationship);
        });
      }
    }

    return relationships;
  }

  /**
   * Identify which objects can be reused across documents
   */
  async identifyReusableAssets(extractedObjects) {
    const reusableAssets = [];

    // Contacts are highly reusable
    if (extractedObjects.contact?.instances.length > 0) {
      extractedObjects.contact.instances.forEach(contact => {
        if (contact.field === 'email' || contact.field === 'phone') {
          reusableAssets.push({
            type: 'contact',
            subtype: contact.field,
            value: contact.value,
            reusability_score: 0.95,
            standardized_format: this.standardizeContact(contact),
            suggested_actions: ['add_to_crm', 'create_contact_card', 'check_duplicates']
          });
        }
      });
    }

    // Organizations are reusable
    if (extractedObjects.organization?.instances.length > 0) {
      extractedObjects.organization.instances.forEach(org => {
        reusableAssets.push({
          type: 'organization',
          subtype: org.field,
          value: org.value,
          reusability_score: 0.9,
          standardized_format: this.standardizeOrganization(org),
          suggested_actions: ['add_to_company_database', 'create_org_profile']
        });
      });
    }

    // Products are reusable
    if (extractedObjects.product?.instances.length > 0) {
      extractedObjects.product.instances.forEach(product => {
        if (product.field === 'sku' || product.field === 'description') {
          reusableAssets.push({
            type: 'product',
            subtype: product.field,
            value: product.value,
            reusability_score: 0.85,
            standardized_format: this.standardizeProduct(product),
            suggested_actions: ['add_to_catalog', 'update_inventory', 'check_pricing']
          });
        }
      });
    }

    return reusableAssets;
  }

  /**
   * Standardize contact information for reuse
   */
  standardizeContact(contact) {
    const standardized = {
      type: 'contact',
      id: this.generateContactId(contact.value),
      raw_value: contact.value
    };

    if (contact.field === 'email') {
      standardized.email = contact.value.toLowerCase().trim();
      standardized.domain = contact.value.split('@')[1];
      standardized.display_name = contact.value.split('@')[0];
    } else if (contact.field === 'phone') {
      standardized.phone = this.normalizePhoneNumber(contact.value);
      standardized.formatted_phone = this.formatPhoneNumber(contact.value);
    } else if (contact.field === 'name') {
      const nameParts = contact.value.trim().split(/\s+/);
      standardized.first_name = nameParts[0];
      standardized.last_name = nameParts.slice(1).join(' ');
      standardized.full_name = contact.value.trim();
    }

    return standardized;
  }

  /**
   * Standardize organization information
   */
  standardizeOrganization(org) {
    const standardized = {
      type: 'organization',
      id: this.generateOrgId(org.value),
      raw_value: org.value,
      name: org.value.trim(),
      normalized_name: org.value.toLowerCase().replace(/[^a-z0-9]/g, ''),
      entity_type: this.detectEntityType(org.value)
    };

    return standardized;
  }

  /**
   * Standardize product information
   */
  standardizeProduct(product) {
    const standardized = {
      type: 'product',
      id: this.generateProductId(product.value),
      raw_value: product.value
    };

    if (product.field === 'sku') {
      standardized.sku = product.value.toUpperCase().trim();
      standardized.normalized_sku = product.value.replace(/[^A-Z0-9]/g, '');
    } else if (product.field === 'description') {
      standardized.description = product.value.trim();
      standardized.keywords = this.extractProductKeywords(product.value);
    }

    return standardized;
  }

  /**
   * Build knowledge graph from decomposed documents
   */
  async buildKnowledgeGraph(decompositions) {
    const knowledgeGraph = {
      nodes: new Map(),
      edges: [],
      clusters: new Map(),
      timestamp: new Date().toISOString()
    };

    // Add nodes for each unique entity
    decompositions.forEach(decomposition => {
      // Add document node
      knowledgeGraph.nodes.set(decomposition.document_id, {
        id: decomposition.document_id,
        type: 'document',
        label: decomposition.source_document,
        properties: {
          filename: decomposition.source_document,
          confidence: decomposition.overall_confidence
        }
      });

      // Add object nodes
      Object.values(decomposition.extracted_objects).forEach(objectGroup => {
        objectGroup.instances.forEach(instance => {
          if (instance.confidence > 0.7) {
            knowledgeGraph.nodes.set(instance.id, {
              id: instance.id,
              type: objectGroup.type,
              label: instance.value,
              properties: instance
            });

            // Add edge from document to object
            knowledgeGraph.edges.push({
              source: decomposition.document_id,
              target: instance.id,
              type: 'contains',
              weight: instance.confidence
            });
          }
        });
      });

      // Add relationship edges
      decomposition.relationships.forEach(relationship => {
        knowledgeGraph.edges.push({
          source: relationship.source_value,
          target: relationship.target_value,
          type: relationship.type,
          weight: relationship.confidence,
          properties: relationship
        });
      });
    });

    // Cluster related entities
    knowledgeGraph.clusters = this.clusterEntities(knowledgeGraph);

    return knowledgeGraph;
  }

  /**
   * Query the knowledge graph for insights
   */
  async queryKnowledgeGraph(knowledgeGraph, query) {
    const queryResults = {
      query: query,
      results: [],
      suggestions: [],
      related_entities: []
    };

    // Simple query processing (would be more sophisticated in production)
    const queryLower = query.toLowerCase();
    
    // Search nodes
    for (const [nodeId, node] of knowledgeGraph.nodes) {
      if (node.label.toLowerCase().includes(queryLower) || 
          node.type.toLowerCase().includes(queryLower)) {
        queryResults.results.push(node);
        
        // Find related entities
        const relatedEdges = knowledgeGraph.edges.filter(edge => 
          edge.source === nodeId || edge.target === nodeId
        );
        
        relatedEdges.forEach(edge => {
          const relatedNodeId = edge.source === nodeId ? edge.target : edge.source;
          if (knowledgeGraph.nodes.has(relatedNodeId)) {
            queryResults.related_entities.push(knowledgeGraph.nodes.get(relatedNodeId));
          }
        });
      }
    }

    return queryResults;
  }

  // Utility methods
  getContext(text, position, radius) {
    const start = Math.max(0, position - radius);
    const end = Math.min(text.length, position + radius);
    return text.substring(start, end);
  }

  generateId() {
    return 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  generateContactId(value) {
    return 'contact_' + value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  generateOrgId(value) {
    return 'org_' + value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  generateProductId(value) {
    return 'product_' + value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  normalizePhoneNumber(phone) {
    return phone.replace(/[^\d]/g, '');
  }

  formatPhoneNumber(phone) {
    const cleaned = this.normalizePhoneNumber(phone);
    if (cleaned.length === 10) {
      return `(${cleaned.substr(0,3)}) ${cleaned.substr(3,3)}-${cleaned.substr(6,4)}`;
    }
    return phone;
  }

  detectEntityType(orgName) {
    if (orgName.match(/\b(Inc|Corp|Corporation)\b/i)) return 'corporation';
    if (orgName.match(/\b(LLC|Ltd|Limited)\b/i)) return 'limited_liability';
    if (orgName.match(/\b(LP|LLP)\b/i)) return 'partnership';
    return 'unknown';
  }

  extractProductKeywords(description) {
    return description.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['the', 'and', 'for', 'with'].includes(word))
      .slice(0, 5);
  }

  validateAndEnrichInstances(instances, objectType) {
    // Add validation logic specific to object type
    return instances.filter(instance => {
      // Basic validation - non-empty value
      if (!instance.value || instance.value.trim().length === 0) return false;
      
      // Type-specific validation
      if (objectType === 'contact' && instance.field === 'email') {
        return instance.value.includes('@') && instance.value.includes('.');
      }
      
      if (objectType === 'financial' && instance.field === 'amount') {
        return /^\$?[\d,]+\.?\d*$/.test(instance.value);
      }
      
      return true;
    });
  }

  calculateOverallConfidence(extractedObjects) {
    let totalConfidence = 0;
    let objectCount = 0;
    
    Object.values(extractedObjects).forEach(objectGroup => {
      if (objectGroup.instances.length > 0) {
        totalConfidence += objectGroup.confidence;
        objectCount++;
      }
    });
    
    return objectCount > 0 ? totalConfidence / objectCount : 0;
  }

  clusterEntities(knowledgeGraph) {
    // Simple clustering based on edge connections
    const clusters = new Map();
    const visited = new Set();
    let clusterId = 0;

    for (const [nodeId, node] of knowledgeGraph.nodes) {
      if (!visited.has(nodeId)) {
        const cluster = this.findConnectedComponents(knowledgeGraph, nodeId, visited);
        clusters.set(`cluster_${clusterId++}`, {
          id: `cluster_${clusterId}`,
          nodes: cluster,
          type: this.inferClusterType(cluster, knowledgeGraph),
          size: cluster.length
        });
      }
    }

    return clusters;
  }

  findConnectedComponents(knowledgeGraph, startNodeId, visited) {
    const component = [];
    const stack = [startNodeId];

    while (stack.length > 0) {
      const nodeId = stack.pop();
      if (!visited.has(nodeId)) {
        visited.add(nodeId);
        component.push(nodeId);

        // Find connected nodes
        knowledgeGraph.edges.forEach(edge => {
          if (edge.source === nodeId && !visited.has(edge.target)) {
            stack.push(edge.target);
          } else if (edge.target === nodeId && !visited.has(edge.source)) {
            stack.push(edge.source);
          }
        });
      }
    }

    return component;
  }

  inferClusterType(nodeIds, knowledgeGraph) {
    const nodeTypes = nodeIds.map(id => knowledgeGraph.nodes.get(id)?.type).filter(Boolean);
    const typeCounts = nodeTypes.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Return the most common type
    return Object.keys(typeCounts).reduce((a, b) => typeCounts[a] > typeCounts[b] ? a : b);
  }
}

// Usage Example:
/*
const semanticEngine = new SemanticDocumentEngine();

// Process a complex document
const documentText = `
  Invoice #INV-2024-001
  Bill To: John Smith, john.smith@acme.com
  Acme Corporation Inc.
  123 Business Ave, New York, NY 10001
  
  Product: Widget Pro (SKU: WGT-PRO-001)
  Quantity: 50
  Price: $25.00 each
  Total: $1,250.00
  
  Due Date: 03/15/2024
`;

const decomposition = await semanticEngine.decomposeDocument(documentText, {
  id: 'doc_001',
  filename: 'invoice_march_2024.pdf'
});

console.log('Extracted Objects:', decomposition.extracted_objects);
console.log('Relationships:', decomposition.relationships);
console.log('Reusable Assets:', decomposition.reusable_assets);

// Build knowledge graph from multiple documents
const knowledgeGraph = await semanticEngine.buildKnowledgeGraph([decomposition]);

// Query the knowledge graph
const queryResults = await semanticEngine.queryKnowledgeGraph(knowledgeGraph, 'John Smith');
console.log('Query Results:', queryResults);
*/
