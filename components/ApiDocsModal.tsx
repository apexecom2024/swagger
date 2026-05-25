/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useTools, useSettings, useUI, FunctionCall } from '@/lib/state';
import { useState, useEffect } from 'react';

// Helper to convert school-case/screaming-case Google Schema parameters to lower-case OpenAPI Schema
const convertGoogleToOpenAiSchema = (googleParams: any) => {
  if (!googleParams) return {};
  
  const convertType = (t: string) => {
    switch (t?.toUpperCase()) {
      case 'STRING': return 'string';
      case 'NUMBER': return 'number';
      case 'INTEGER': return 'integer';
      case 'BOOLEAN': return 'boolean';
      case 'OBJECT': return 'object';
      case 'ARRAY': return 'array';
      default: return 'string';
    }
  };

  const traverse = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    
    const result: any = {};
    for (const key in obj) {
      if (key === 'type' && typeof obj[key] === 'string') {
        result[key] = convertType(obj[key]);
      } else if (typeof obj[key] === 'object') {
        result[key] = traverse(obj[key]);
      } else {
        result[key] = obj[key];
      }
    }
    return result;
  };

  return traverse(googleParams);
};

export default function ApiDocsModal() {
  const { isApiDocsOpen, setApiDocsOpen } = useUI();
  const { tools } = useTools();
  const { systemPrompt, model, voice } = useSettings();
  
  // Active selected API spec category
  const [activeTab, setActiveTab] = useState<'openai' | 'websocket' | 'tools'>('openai');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  // Collapsed endpoints state
  const [expandedEndpoints, setExpandedEndpoints] = useState<Record<string, boolean>>({
    'chat-completions': true,
    'transcriptions': false,
    'speech': false,
    'ws-endpoint': true,
  });

  // Dynamic sandbox parameters for try-it-out
  const [chatInput, setChatInput] = useState('Check my order status for order ID #98765');
  const [chatResponse, setChatResponse] = useState<any>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSystemPrompt, setChatSystemPrompt] = useState(systemPrompt);

  // Dynamic parameters for live tools sandbox execution
  const [toolInputs, setToolInputs] = useState<Record<string, Record<string, string>>>({});
  const [toolResponses, setToolResponses] = useState<Record<string, { status: number; body: any }>>({});
  const [toolLoading, setToolLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setChatSystemPrompt(systemPrompt);
  }, [systemPrompt]);

  if (!isApiDocsOpen) return null;

  const toggleEndpoint = (id: string) => {
    setExpandedEndpoints(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Convert current tools to OpenAI compatible functions array
  const openAiTools = tools
    .filter(t => t.isEnabled)
    .map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description || '',
        parameters: convertGoogleToOpenAiSchema(t.parameters)
      }
    }));

  const mockOpenAiResponse = (userInput: string) => {
    setChatLoading(true);
    setTimeout(() => {
      let isToolMatch = false;
      let matchedTool: any = null;
      let matchedArgs: any = {};

      // Simple keyword matching for demo sandbox
      const activeEnabledTools = tools.filter(t => t.isEnabled);
      
      for (const t of activeEnabledTools) {
        if (t.name === 'get_order_status' && (userInput.toLowerCase().includes('order') || userInput.toLowerCase().includes('status'))) {
          isToolMatch = true;
          matchedTool = t;
          matchedArgs = { orderId: '98765', customerName: 'Alex Mercer' };
          break;
        } else if (t.name === 'start_return' && (userInput.toLowerCase().includes('return') || userInput.toLowerCase().includes('refund'))) {
          isToolMatch = true;
          matchedTool = t;
          matchedArgs = { orderId: '44521', itemName: 'UltraComfort Sneakers', reason: 'Fits too tight' };
          break;
        } else if (t.name === 'speak_to_representative' && (userInput.toLowerCase().includes('agent') || userInput.toLowerCase().includes('human') || userInput.toLowerCase().includes('representative'))) {
          isToolMatch = true;
          matchedTool = t;
          matchedArgs = { reason: 'User requested direct assistance after multiple failed attempts.' };
          break;
        } else if (t.name === 'create_calendar_event' && (userInput.toLowerCase().includes('event') || userInput.toLowerCase().includes('calendar') || userInput.toLowerCase().includes('schedule'))) {
          isToolMatch = true;
          matchedTool = t;
          matchedArgs = { summary: 'Project Sync Meeting', startTime: '2026-05-26T10:00:00Z', endTime: '2026-05-26T11:00:00Z' };
          break;
        } else if (t.name === 'send_email' && (userInput.toLowerCase().includes('email') || userInput.toLowerCase().includes('send'))) {
          isToolMatch = true;
          matchedTool = t;
          matchedArgs = { recipient: 'john.doe@example.com', subject: 'Status Update', body: 'The application specs look complete.' };
          break;
        } else if (t.name === 'set_reminder' && (userInput.toLowerCase().includes('remind') || userInput.toLowerCase().includes('reminder'))) {
          isToolMatch = true;
          matchedTool = t;
          matchedArgs = { task: 'Take a short recess', time: '2026-05-25T18:30:00Z' };
          break;
        } else if (t.name === 'find_route' && (userInput.toLowerCase().includes('route') || userInput.toLowerCase().includes('directions') || userInput.toLowerCase().includes('navigate'))) {
          isToolMatch = true;
          matchedTool = t;
          matchedArgs = { destination: 'Golden Gate Park', modeOfTransport: 'driving' };
          break;
        } else if (t.name === 'find_nearby_places' && (userInput.toLowerCase().includes('nearby') || userInput.toLowerCase().includes('find') || userInput.toLowerCase().includes('places') || userInput.toLowerCase().includes('restaurant'))) {
          isToolMatch = true;
          matchedTool = t;
          matchedArgs = { placeType: 'cafeteria', radius: 2.5 };
          break;
        } else if (t.name === 'get_traffic_info' && (userInput.toLowerCase().includes('traffic') || userInput.toLowerCase().includes('jam'))) {
          isToolMatch = true;
          matchedTool = t;
          matchedArgs = { location: 'Downtown grid' };
          break;
        }
      }

      // If no pre-configured matching, but we have some enabled tools, just call the first enabled tool
      if (!isToolMatch && activeEnabledTools.length > 0) {
        // 30% chance of making a general response, 70% chance of checking first tool
        if (Math.random() > 0.3) {
          isToolMatch = true;
          matchedTool = activeEnabledTools[0];
          // Fill properties dynamically
          const props = matchedTool.parameters?.properties || {};
          Object.keys(props).forEach(k => {
            matchedArgs[k] = props[k].type === 'NUMBER' ? 100 : 'custom_input_value';
          });
        }
      }

      let responseObj: any = {
        id: `chatcmpl-${Math.random().toString(36).substr(2, 9)}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'gpt-4o-compatible',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: isToolMatch 
                ? `I need to run the tool function: ${matchedTool.name} to fulfill your request.` 
                : `I have received your message: "${userInput}". I can assist you with your queries or run function calling tools as configured.`
            },
            logprobs: null,
            finish_reason: isToolMatch ? 'tool_calls' : 'stop'
          }
        ],
        usage: {
          prompt_tokens: 35 + userInput.length,
          completion_tokens: isToolMatch ? 28 : 22,
          total_tokens: 57 + userInput.length
        }
      };

      if (isToolMatch) {
        responseObj.choices[0].message.tool_calls = [
          {
            id: `call_${Math.random().toString(36).substr(2, 9)}`,
            type: 'function',
            function: {
              name: matchedTool.name,
              arguments: JSON.stringify(matchedArgs)
            }
          }
        ];
      }

      setChatResponse(responseObj);
      setChatLoading(false);
    }, 1000);
  };

  const handleToolExecute = (toolName: string, fields: any) => {
    setToolLoading(prev => ({ ...prev, [toolName]: true }));
    setTimeout(() => {
      const inputs = toolInputs[toolName] || {};
      const generatedResp = {
        status: 'success',
        message: `Dynamic local execution of sandbox function '${toolName}' completed.`,
        executionTimeMs: Math.floor(Math.random() * 80) + 10,
        payload: {
          ...inputs,
          result: 'ok',
          processedAt: new Date().toISOString()
        }
      };
      setToolResponses(prev => ({
        ...prev,
        [toolName]: { status: 200, body: generatedResp }
      }));
      setToolLoading(prev => ({ ...prev, [toolName]: false }));
    }, 750);
  };

  const handleToolInputChange = (toolName: string, paramName: string, val: string) => {
    setToolInputs(prev => ({
      ...prev,
      [toolName]: {
        ...(prev[toolName] || {}),
        [paramName]: val
      }
    }));
  };

  return (
    <div className="api-docs-shroud" onClick={() => setApiDocsOpen(false)}>
      <div className="api-docs-modal" onClick={e => e.stopPropagation()}>
        {/* Swagger Navigation / Header */}
        <div className="api-docs-header">
          <div className="swagger-brand">
            <span className="swagger-logo"></span>
            <h2>Swagger UI <span className="api-version">v3.0 (OpenAI Compatible)</span></h2>
          </div>
          <button className="api-docs-close" onClick={() => setApiDocsOpen(false)}>
            <span className="icon">close</span>
          </button>
        </div>

        {/* Info Area */}
        <div className="api-info-section">
          <div className="api-title-row">
            <h1>Sandbox API Specifications</h1>
            <span className="api-meta-badge">OAS 3.0</span>
          </div>
          <p className="api-description">
            Interactive reference and live sandbox environment for the application's toolsets. It translates 
            Google's schema rules into standard OpenAI-compatible tool specifications in real-time, allowing 
            you to interface easily with ChatGPT/GPT-4o or Claude. Feel free to use the 
            <strong> "Try it out"</strong> panels below to execute functions live and view formatted response outputs.
          </p>
          <div className="api-meta-details">
            <div className="meta-item">
              <span className="meta-label">Servers</span>
              <select className="server-select">
                <option value="local">Local Sandbox - {window.location.origin}</option>
                <option value="openai">OpenAI Endpoint - https://api.openai.com/v1</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tab Controllers */}
        <div className="api-docs-tabs">
          <button 
            className={`tab-btn ${activeTab === 'openai' ? 'active' : ''}`}
            onClick={() => setActiveTab('openai')}
          >
            <span className="icon">swap_horiz</span> OpenAI API (REST)
          </button>
          <button 
            className={`tab-btn ${activeTab === 'websocket' ? 'active' : ''}`}
            onClick={() => setActiveTab('websocket')}
          >
            <span className="icon">settings_ethernet</span> Live WebSocket API
          </button>
          <button 
            className={`tab-btn ${activeTab === 'tools' ? 'active' : ''}`}
            onClick={() => setActiveTab('tools')}
          >
            <span className="icon">terminal</span> Dynamic Tool Methods ({tools.filter(t => t.isEnabled).length})
          </button>
        </div>

        {/* Documentation Content */}
        <div className="api-docs-body">

          {/* OPENAI REST TAB */}
          {activeTab === 'openai' && (
            <div className="api-tag-group">
              <h3 className="group-title">OpenAI Compatible Chat & Speech Endpoints</h3>
              <p className="group-desc">Simulate standard OpenAI endpoint specifications using the currently enabled sandbox schema rules.</p>
              
              {/* Endpoint 1: chat/completions */}
              <div className={`swagger-op post ${expandedEndpoints['chat-completions'] ? 'expanded' : ''}`}>
                <div className="op-summary" onClick={() => toggleEndpoint('chat-completions')}>
                  <span className="op-method">POST</span>
                  <span className="op-path">/v1/chat/completions</span>
                  <span className="op-desc">Create chat completions with sandbox tool schemas</span>
                  <span className="icon dropdown-icon">expand_more</span>
                </div>
                
                {expandedEndpoints['chat-completions'] && (
                  <div className="op-details">
                    <div className="section-title">Request Specification</div>
                    <p className="section-intro">Uses the currently configured tools schema translate to OpenAI function format in real-time.</p>
                    
                    <div className="spec-grid">
                      <div className="spec-panel">
                        <div className="panel-header">
                          <span>OpenAI Compatible Tool JSON schema (Dynamic)</span>
                          <button 
                            className="copy-btn"
                            onClick={() => copyToClipboard(JSON.stringify(openAiTools, null, 2), 'tools-schema')}
                          >
                            {copiedText === 'tools-schema' ? 'Copied ✅' : 'Copy Schema'}
                          </button>
                        </div>
                        <pre className="code-block">
                          <code>{JSON.stringify(openAiTools, null, 2)}</code>
                        </pre>
                      </div>

                      <div className="spec-panel try-it-out-panel">
                        <div className="panel-header text-highlight">
                          <span>Interactive Playground (Try it out)</span>
                        </div>
                        <div className="playground-form">
                          <label className="field-label">System Prompt
                            <textarea 
                              value={chatSystemPrompt} 
                              onChange={e => setChatSystemPrompt(e.target.value)} 
                              rows={2} 
                            />
                          </label>
                          <label className="field-label">User Query input
                            <input 
                              type="text" 
                              value={chatInput} 
                              onChange={e => setChatInput(e.target.value)} 
                              placeholder="e.g. Check my order status..."
                            />
                          </label>
                          <div className="active-tools-indicator font-mono">
                            🛠️ Enabled functions tracked: {tools.filter(t => t.isEnabled).map(t => `'${t.name}'`).join(', ') || 'none'}
                          </div>
                          
                          <button 
                            className="execute-btn" 
                            onClick={() => mockOpenAiResponse(chatInput)}
                            disabled={chatLoading}
                          >
                            {chatLoading ? 'Invoking Model...' : 'Execute API Call'}
                          </button>

                          {chatResponse && (
                            <div className="execution-output">
                              <div className="output-header">
                                <span>Response headers</span>
                                <span className="resp-status">200 OK</span>
                              </div>
                              <pre className="output-block code-block">
                                <code>{JSON.stringify(chatResponse, null, 2)}</code>
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Endpoint 2: transcriptions */}
              <div className={`swagger-op post ${expandedEndpoints['transcriptions'] ? 'expanded' : ''}`}>
                <div className="op-summary" onClick={() => toggleEndpoint('transcriptions')}>
                  <span className="op-method">POST</span>
                  <span className="op-path">/v1/audio/transcriptions</span>
                  <span className="op-desc">Transcribe binary audio to text (Whisper format)</span>
                  <span className="icon dropdown-icon">expand_more</span>
                </div>

                {expandedEndpoints['transcriptions'] && (
                  <div className="op-details">
                    <div className="section-title">Request Parameters</div>
                    <table className="params-table">
                      <thead>
                        <tr>
                          <th>Parameter</th>
                          <th>Value Type</th>
                          <th>Location</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="param-name">file *</td>
                          <td className="param-type">binary</td>
                          <td className="param-loc">formData</td>
                          <td>The raw audio file to transcribe. Supports wav, mp3, webm (PCM 16-bit).</td>
                        </tr>
                        <tr>
                          <td className="param-name">model *</td>
                          <td className="param-type">string</td>
                          <td className="param-loc">formData</td>
                          <td>Set to <code>whisper-1</code>.</td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="section-title">Response format</div>
                    <pre className="code-block">
                      <code>{JSON.stringify({ text: "This is the transcribed text from the sandbox's microphone stream." }, null, 2)}</code>
                    </pre>
                  </div>
                )}
              </div>

              {/* Endpoint 3: speech */}
              <div className={`swagger-op post ${expandedEndpoints['speech'] ? 'expanded' : ''}`}>
                <div className="op-summary" onClick={() => toggleEndpoint('speech')}>
                  <span className="op-method">POST</span>
                  <span className="op-path">/v1/audio/speech</span>
                  <span className="op-desc">Generate spoken audio text-to-speech (TTS)</span>
                  <span className="icon dropdown-icon">expand_more</span>
                </div>

                {expandedEndpoints['speech'] && (
                  <div className="op-details">
                    <div className="section-title">Request Body</div>
                    <pre className="code-block">
                      <code>{JSON.stringify({ model: "tts-1", input: "Hello, sandbox user!", voice: voice }, null, 2)}</code>
                    </pre>
                    <div className="section-title">Response</div>
                    <p className="response-desc">Returns a binary stream containing the generated audio chunk (MIME type: <code>audio/mpeg</code>).</p>
                  </div>
                )}
              </div>
            </div>
          )}


          {/* WEBSOCKET TAB */}
          {activeTab === 'websocket' && (
            <div className="api-tag-group">
              <h3 className="group-title">Gemini Live Bidirectional Streaming Endpoint</h3>
              <p className="group-desc">Detailed specification for connecting to the Gemini Multimodal Live Streaming WebSocket.</p>

              <div className={`swagger-op ws ${expandedEndpoints['ws-endpoint'] ? 'expanded' : ''}`}>
                <div className="op-summary" onClick={() => toggleEndpoint('ws-endpoint')}>
                  <span className="op-method">WS</span>
                  <span className="op-path">/ws/v1/live/stream</span>
                  <span className="op-desc">Bi-directional Webhook Stream for audio inputs & tools responses</span>
                  <span className="icon dropdown-icon">expand_more</span>
                </div>

                {expandedEndpoints['ws-endpoint'] && (
                  <div className="op-details">
                    <div className="info-alert">
                      ℹ️ This app uses a lightweight custom WebSockets class (<code>GenAILiveClient</code>) to execute real-time audio interaction on model: <strong>{model}</strong>.
                    </div>
                    
                    <div className="section-title">Establishment URL</div>
                    <pre className="code-block ws-url">
                      <code>wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent</code>
                    </pre>

                    <div className="spec-grid">
                      <div className="spec-panel">
                        <div className="panel-header">
                          <span>Initialization Handshake payload</span>
                        </div>
                        <pre className="code-block">
                          <code>{JSON.stringify({
                            setup: {
                              model: `models/${model}`,
                              generationConfig: {
                                responseModalities: ["AUDIO"],
                                speechConfig: {
                                  voiceConfig: {
                                    prebuiltVoiceConfig: {
                                      voiceName: voice
                                    }
                                  }
                                }
                              },
                              systemInstruction: {
                                parts: [{ text: systemPrompt }]
                              },
                              tools: [{
                                functionDeclarations: tools.filter(t => t.isEnabled).map(t => ({
                                  name: t.name,
                                  description: t.description,
                                  parameters: t.parameters
                                }))
                              }]
                            }
                          }, null, 2)}</code>
                        </pre>
                      </div>

                      <div className="spec-panel">
                        <div className="panel-header">
                          <span>Bidirectional Frame event definitions</span>
                        </div>
                        <div className="ws-definitions font-sans">
                          <div className="ws-def-block">
                            <strong>1. Client Audio Output Stream (PCM 16-bit)</strong>
                            <p>Sends base64 audio blocks within continuous JSON frames:</p>
                            <pre className="mini-code">
                              {"{ \"realtimeInput\": { \"mediaChunks\": [{ \"mimeType\": \"audio/pcm\", \"data\": \"BASE64_STREAM_DATA\" }] } }"}
                            </pre>
                          </div>
                          <div className="ws-def-block">
                            <strong>2. Server Tool Execution Handshake (`toolcall`)</strong>
                            <p>Sent by Gemini to request execution of sandboxed functions:</p>
                            <pre className="mini-code">
                              {"{ \"toolCall\": { \"functionCalls\": [{ \"id\": \"fc_1\", \"name\": \"start_return\", \"args\": { \"orderId\": \"123\" } }] } }"}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}


          {/* TOOLS REST TAB */}
          {activeTab === 'tools' && (
            <div className="api-tag-group">
              <h3 className="group-title">Dynamic Active API Methods</h3>
              <p className="group-desc">Lists each active tool defined in the sandbox as a standard REST API resource method representation.</p>

              {tools.filter(t => t.isEnabled).length === 0 ? (
                <div className="empty-tools-state font-sans">
                  ⚠️ No active tools configured in settings! Toggle some tools on in the Sidebar panel first.
                </div>
              ) : (
                tools.filter(t => t.isEnabled).map((tool) => {
                  const props = tool.parameters?.properties || {};
                  const requiredList = tool.parameters?.required || [];
                  const inputsKey = tool.name;

                  return (
                    <div 
                      key={tool.name} 
                      className={`swagger-op post ${expandedEndpoints[tool.name] ? 'expanded' : ''}`}
                    >
                      <div className="op-summary" onClick={() => toggleEndpoint(tool.name)}>
                        <span className="op-method">POST</span>
                        <span className="op-path">/api/tools/{tool.name}</span>
                        <span className="op-desc">{tool.description || 'Custom sandboxed method call'}</span>
                        <span className="icon dropdown-icon">expand_more</span>
                      </div>

                      {expandedEndpoints[tool.name] && (
                        <div className="op-details">
                          <div className="section-title">Query Parameters (JSON Schema Inputs)</div>
                          
                          {Object.keys(props).length === 0 ? (
                            <p className="no-params-text">This tool takes empty parameters.</p>
                          ) : (
                            <table className="params-table">
                              <thead>
                                <tr>
                                  <th>Parameter</th>
                                  <th>Type</th>
                                  <th>Status</th>
                                  <th>Description</th>
                                  <th>Playground Input</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.keys(props).map((paramName) => {
                                  const paramInfo = props[paramName];
                                  const isRequired = requiredList.includes(paramName);
                                  const currentVal = toolInputs[inputsKey]?.[paramName] || '';
                                  
                                  return (
                                    <tr key={paramName}>
                                      <td className="param-name font-mono">{paramName} {isRequired && <span className="req-star">*</span>}</td>
                                      <td className="param-type font-mono">{paramInfo.type?.toLowerCase() || 'string'}</td>
                                      <td>
                                        <span className={`req-badge ${isRequired ? 'required' : 'optional'}`}>
                                          {isRequired ? 'required' : 'optional'}
                                        </span>
                                      </td>
                                      <td>{paramInfo.description || 'No description provided.'}</td>
                                      <td>
                                        <input
                                          type="text"
                                          className="playground-table-input"
                                          placeholder={`Enter ${paramName}...`}
                                          value={currentVal}
                                          onChange={(e) => handleToolInputChange(inputsKey, paramName, e.target.value)}
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}

                          <div className="playground-launch-bar">
                            <button
                              className="execute-btn"
                              onClick={() => handleToolExecute(tool.name, props)}
                              disabled={toolLoading[tool.name]}
                            >
                              {toolLoading[tool.name] ? 'Invoking Method...' : 'Test Sandbox Method'}
                            </button>
                          </div>

                          {toolResponses[tool.name] && (
                            <div className="execution-output">
                              <div className="output-header">
                                <span>Response Status</span>
                                <span className="resp-status font-mono">200 SUCCESS</span>
                              </div>
                              <pre className="output-block code-block">
                                <code>{JSON.stringify(toolResponses[tool.name].body, null, 2)}</code>
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
