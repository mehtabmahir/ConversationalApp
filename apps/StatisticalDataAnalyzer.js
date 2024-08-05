import { ConversationalApp } from '../ConversationalApp.js';

export class StatisticalDataAnalyzer extends ConversationalApp {
  appName = 'Statistical Data Analyzer';
  chatListTitle = 'My Data';
  newChatLabel = 'New Data';
  chatStartInstruction = 'Please provide me with the data you want to analyze';
  appIconName = 'insert_chart';
  
  temperature = 0;

  constructor(context) {
    super(context);
    
  }


  
   getDefaultMessages() {
    
    return [
      {
        "role": "system", "content": `You are data analyzer, your role is to analyzing and interpreting the data 
        , you extract relevant information, and perform calculations to generate insights based on the question I ask.
        you help in answer question, extract and visualize data. if your answer has statistical data,
        please extract them as a table (in markdown format) delimited by 4 equal marks ====.
            After that, please provide a YAML structure that represents a config for Chart.js library based on the following JSON schema:
            ${JSON.stringify(this.getJSONSchema())}

            The YAML structure must be delimited by \`\`\`.
            After that list important trends in the extracted data if any.
            So, the expected response for the first response and subsequence responses for modifications will be:
            ====
            {Table}
            ====
            \`\`\`
            {YAML}
            \`\`\`
            {Trends}` },
      {
        "role": "user", "content": `I'll provide you with a data-related question in text .`
      },
      { "role": "assistant", "content": "Sure, please provide your questions" }
    ];
  }

  getChatNameFromMessage(message) {
    const config = this.getChartConfig(message);
    if (!config) {
      return null;
    }
    return config.options?.title?.text || null;
  }

  getTextMessage(message) {
    let messageParts = message.split(/```[^\n]*\n?/);
    let responseMessage = (messageParts[0] || '').trim();
    responseMessage += '\n' + (messageParts.length <= 2 ? '' : messageParts.slice(2).join('\n').trim());
    messageParts = responseMessage.split(/===[^\n]*\n?/);
    responseMessage = (messageParts[0] || '').trim();
    responseMessage += '\n' + (messageParts.length <= 2 ? '' : messageParts.slice(2).join('\n').trim());
    return responseMessage;
  }

  getAppContent(message) {
    const config = this.getChartConfig(message);
    const messageParts = message.split(/===[^\n]*\n?/);
    let data = messageParts[1] || '';
    if (!config && !data) {
      return '';
    }

    if (data) {
      data = JSON.stringify(data);
    }

    const dataVar = data ? `${data} || ` : '';

    return this.getStyles() + '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.3.0/dist/chart.umd.min.js"></script><script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script><div class="list-container"><canvas id="myChart"></canvas><div id="data-table"></div></div>' + `<script>
        clearTimeout(window['charttimeout']);
        window['data'] = ${dataVar}window['data'] || '';
        window['charttimeout'] = setTimeout(()=> {
            new Chart(document.getElementById('myChart'), ${JSON.stringify(config)});
            if(window['data']) {
                document.getElementById('data-table').innerHTML = marked.parse(window['data']);
            }
        }, 500);

        </script>`;
  }

  getChartConfig(message) {
    const messageParts = message.split(/```[^\n]*\n?/);

    let chartConfig = messageParts[1] || '';
    if (!chartConfig) {
      return '';
    }

    return this.parseYaml(chartConfig.trim());
  }

  getStyles() {
    return `<style>
        table {
            background-color: #f8f9fa;
            color: #202122;
            margin: 1em 0;
            border: 1px solid #a2a9b1;
            border-collapse: collapse;
            min-width: 80%;
            margin: 10px auto;
        }
        th {
            background-color: #eaecf0;
            text-align: center;
        }
        th, td {
            border: 1px solid #a2a9b1;
            padding: 0.2em 0.4em;
        }
        .list-container {
            padding: 20px;
            display: flex;
            flex-direction: column;
        }
        </style>`;
  }

  getJSONSchema() {
    return {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "title": "ChartConfig",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "line",
            "bar",
            "pie",
            "doughnut",
            "radar",
            "polarArea",
            "bubble",
            "scatter"
          ]
        },
        "data": {
          "type": "object",
          "properties": {
            "labels": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "datasets": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "label": {
                    "type": "string"
                  },
                  "data": {
                    "type": "array",
                    "items": {
                      "type": "number"
                    }
                  },
                  "backgroundColor": {
                    "type": "string"
                  },
                  "borderColor": {
                    "type": "string"
                  },
                  "borderWidth": {
                    "type": "number"
                  }
                },
                "required": ["label", "data"]
              }
            }
          },
          "required": ["labels", "datasets"]
        },
        "options": {
          "type": "object",
          "properties": {
            "title": {
              "type": "object",
              "properties": {
                "display": {
                  "type": "boolean"
                },
                "text": {
                  "type": "string"
                }
              }
            },
            "legend": {
              "type": "object",
              "properties": {
                "display": {
                  "type": "boolean"
                },
                "position": {
                  "type": "string",
                  "enum": ["top", "bottom", "left", "right"]
                }
              }
            },
            "scales": {
              "type": "object",
              "properties": {
                "xAxes": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "scaleLabel": {
                        "type": "object",
                        "properties": {
                          "display": {
                            "type": "boolean"
                          },
                          "labelString": {
                            "type": "string"
                          }
                        }
                      }
                    }
                  }
                },
                "yAxes": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "ticks": {
                        "type": "object",
                        "properties": {
                          "beginAtZero": {
                            "type": "boolean"
                          }
                        }
                      },
                      "scaleLabel": {
                        "type": "object",
                        "properties": {
                          "display": {
                            "type": "boolean"
                          },
                          "labelString": {
                            "type": "string"
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "required": ["type", "data"]
    };
  }
}