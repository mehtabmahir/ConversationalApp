import { ConversationalApp } from '../ConversationalApp.js';

export class QuizGenerator extends ConversationalApp {
    appName = 'Quiz Generator';
    chatListTitle = 'My Topics';
    newChatLabel = 'New Topic';
    chatStartInstruction = 'Please provide the article/document/topic that you want to generate a quiz for.';
    appIconName = 'quiz';

    constructor(context) {
        super(context);
    }

    getDefaultMessages() {
        const mainMessage = `
        I'll or you'll provide an article or document content and you will generate a comprehensive multiple choice quiz that covers only the provided content.
        Please provide the quiz in YAML format delimited by four dashes (----) based on the following JSON schema:
        ${JSON.stringify(this.getResponseSchema(), null, 2)}

        Only one choice can be correct, if there are multiple correct choices, then the correct choices should be combined into a new choice. For example, if options A and C are both correct, the new choice could be "A and C."
        `;
        return [
            { "role": "system", "content": "You are Quizzer, the quiz generator."},
            { "role": "user", "content": mainMessage},
            { "role": "user", "content": "Please don't include code markdown characters ``` in the response."},
            { "role": "assistant", "content": "Please provide the content that you would like me to generate a quiz for."}
        ];
    }

    getChatNameFromMessage(message) {
        let msg = this.getAppContentData(message);
        return msg?.QuizTitle || '';
    }

    getTextMessage(message) {
        const messageParts = message.split(/----*/g);
        let responseMessage = (messageParts[0] || '').trim();
        responseMessage += '\n' + (messageParts.length <= 2 ? '' : messageParts.slice(2).join('\n').trim());
        return responseMessage;
    }

    getAppContentData(message) {
        const messageParts = message.split(/----*/g);

        let yaml = messageParts[1] || null;
        if(!yaml) {
            return null;
        }
        return this.parseYaml(yaml);
    }

    getAppContent(message) {
        let quizInfo = this.getAppContentData(message);
        if(!quizInfo) {
            return null;
        }

        let quizHtml = '<div id="quiz"><div id="mark" class="circle-sketch-highlight"> </div><form onsubmit="void(this.parentElement.classList.toggle(\'answered\')); calculateMark(); return false;" onreset="resetQuestions();"><h1 id="quiztitle">' + quizInfo.QuizTitle + '</h1><ul>';
        const questions = quizInfo.Questions || [];
        let questionNumber = 0;
        for(let question of questions) {
            quizHtml += '<li class="question"><h3><span>' + (++questionNumber) + '</span> ' + question.Question + '</h3><ul>';
            const choices = question.Choices || [];
            for(let choice of choices) {
                const correct = (choice.Letter == question.CorrectAnswerLetter);
                quizHtml += '<li><input type="radio" onchange="this.parentElement.parentElement.parentElement.classList.' + (correct? 'add' : 'remove') + '(\'qc\');calculateMark();" name="q' + questionNumber + '" value="' + choice.Letter + '" data-correct="' + correct + '" /><span>' + choice.Letter + ' - ' + choice.Choice + '</span></li>';
            }
            quizHtml += '</ul></li>';
        }

        quizHtml += '</ul><div class="footer-actions"><input type="submit" value="Submit" /> <input type="reset" value="Retry" /><div></form></div>';
            
        return this.getJS() + '<button class="download-button" onclick="downloadAsHTMLFile()">Download HTML</button> <button class="download-button" onclick="downloadAsGIFTFile()">Download GIFT</button><div id="result-container-html" class="result-container">' + this.getStyles() + this.getContentJS() + quizHtml + '</div>';
    }

    getStyles() {
        return `<style>
        .download-button {
            margin-bottom: 5px;
            padding: 1px 10px;
            border-radius: 5px;
            background-color: #34d399;
            color: #FFF;
            font-weight: 300;
        }
        #quiz {
            box-shadow: rgba(9, 30, 66, 0.25) 0px 4px 8px -2px, rgba(9, 30, 66, 0.08) 0px 0px 0px 1px;
            border-radius: 10px;
            padding: 10px;
            margin: 10px;
            font-family: Arial, Helvetica, sans-serif;
            position: relative;
            background-color: #FFF;
        }

        #quiz .circle-sketch-highlight {
            position: fixed;
            right: 30px;
            top: 30px;
            font-size: 40px;
            color: #f00;
            font-style: italic;
            display: none;
        }

        #result-container-html #quiz .circle-sketch-highlight {
            right: 60px;
            top: 120px;
        }

        #quiz.answered .circle-sketch-highlight {
            display: block;
        }
          
        #quiz .circle-sketch-highlight:before{
            content: "";
            z-index: -1;
            left: -0.49em;
            top: -0.05em;
            border-width: 2px;
            border-style: solid;
            border-color: red;
            position: absolute;
            border-right-color: transparent;
            width: 150%;
            height: 100%;
            transform: rotate(2deg);
            opacity: 0.7;
            border-radius: 50%;
            padding: 0.1em 0.25em;
        }
          
        #quiz .circle-sketch-highlight:after{
            content: "";
            z-index: -1;
            left: -0.6em;
            top: -2px;
            padding: 0.1em 0.25em;
            border-width: 2px;
            border-style: solid;
            border-color: red;
            border-left-color: transparent;
            border-top-color: transparent;
            position: absolute;
            width: 160%;
            height: 110%;
            transform: rotate(-1deg);
            opacity: 0.7;
            border-radius: 50%;
        }

        #quiz h1 {
            text-align: center;
            margin-top: 5px;
            font-size: xx-large;
            font-weight: 600;
            margin-bottom: 10px;
        }

        #quiz ul {
            list-style: none;
            margin: 0;
            padding: 5px;
            overflow: auto;
        }

        #quiz .footer-actions {
            padding: 5px 10px;
            margin-top: 20px;
        }

        #quiz .footer-actions input{
            background-color: initial;
            background-image: linear-gradient(-180deg, #00D775, #00BD68);
            border-radius: 5px;
            box-shadow: rgba(0, 0, 0, 0.1) 0 2px 4px;
            color: #FFFFFF;
            cursor: pointer;
            display: inline-block;
            font-family: Inter,-apple-system,system-ui,Roboto,"Helvetica Neue",Arial,sans-serif;
            height: 44px;
            line-height: 44px;
            outline: 0;
            overflow: hidden;
            padding: 0 20px;
            pointer-events: auto;
            position: relative;
            text-align: center;
            touch-action: manipulation;
            user-select: none;
            -webkit-user-select: none;
            vertical-align: top;
            white-space: nowrap;
            z-index: 9;
            border: 0;
        }

        #quiz .footer-actions input:hover {
            background: #00bd68;
        }

        #quiz h3 {
            margin-bottom: 5px;
            border-radius: 5px;
            font-size: larger;
            font-weight: 600;
        }
        #quiz h3 span {
            display: inline-block;
            border-radius: 5px;
            background-color: #b5e9e8;
            padding: 3px;
            width: 28px;
            text-align: center;
            font-size: small;
            height: 28px;
            vertical-align: middle;
            line-height: 22px;
        }

        #quiz.answered h3 {
            background-color: #e9b5b599;
        }
        #quiz.answered h3 span {
            background-color: #e9b5b5;
        }

        #quiz.answered .qc h3 {
            background-color: #b5e9bd99;
        }
        #quiz.answered .qc h3 span {
            background-color: #b5e9bd;
        }

        #quiz .question ul {
            padding-left: 28px;
        }

        #quiz .question li{
            display: flex;
            align-items: flex-start;
            margin-bottom: 7px;
        }

        #quiz input[type=radio] {
            margin-top: 5px;
            margin-right: 5px;
        }

        #quiz.answered .question input[type=radio]:checked+span {
            color: red;
            font-weight: bold;
        }
        #quiz.answered .question input[type=radio][data-correct=true]:checked+span {
            color: green;
            font-weight: bold;
        }
        </style>`;
    }

    getContentJS() {
        return `<script>
        function calculateMark(){
            var questionsCount  = document.getElementById('quiz').getElementsByClassName('question').length;
            var correctCount  = document.getElementById('quiz').getElementsByClassName('qc').length;
            document.getElementById('mark').innerHTML = correctCount + '/' + questionsCount;
        }

        function resetQuestions(){
            document.getElementById('quiz').classList.remove('answered');
            var correctAnswers = document.querySelectorAll('#quiz .qc');
            correctAnswers.forEach((element) => {
                element.classList.remove('qc');
            });
        }
        </script>`;
    }

    getJS() {
        return `<script>
        function downloadAsHTMLFile() {
            resetQuestions();
            var text = document.getElementById('result-container-html').innerHTML;
            var mimeType = 'text/xhtml';
            var title = document.getElementById('quiztitle').innerText;
            downloadAsFile('<!DOCTYPE html><html><head><title>' + title + '</title></head><body>' + text + '</body></html>', mimeType, title + '.html');
        }

        function downloadAsGIFTFile() {
            var text = '';
            var questions = document.querySelectorAll('#quiz .question');
            questions.forEach((element) => {
                text += element.getElementsByTagName('h3')[0].innerText.trim().replace(/([~=#\\{\\}:])/g, '\\\\$1') + '{';
                element.querySelectorAll('li').forEach((li) => {
                    var prefix = li.querySelectorAll('input[data-correct=true]')[0] ? '=' : '~';
                    text += '\\n' + prefix + li.textContent.trim().replace(/([~=#\\{\\}:])/g, '\\\\$1');
                });
                text += '}\\n\\n';
            });
            var mimeType = 'text/plain';
            var title = document.getElementById('quiztitle').innerText;
            downloadAsFile(text, mimeType, title + '.txt');
        }

        function downloadAsFile(text, mimeType, fileName) {
            // Create a Blob object from the text
            const blob = new Blob([text], { type: mimeType });
          
            // Create a URL for the Blob object
            const url = URL.createObjectURL(blob);
          
            // Create a link element for the download
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
          
            // Add the link element to the document
            document.body.appendChild(link);
          
            // Click the link to start the download
            link.click();
          
            // Remove the link element from the document
            document.body.removeChild(link);
          
            // Revoke the URL to free up memory
            URL.revokeObjectURL(url);
          }
        </script>`;
    }

    getResponseSchema() {
        return {
            "type" : "object",
            "properties": {
                "Questions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "Question": { "type": "string" },
                            "CorrectAnswerLetter":  { "type": "string",  "enum": ["A", "B", "C", "D", "E", "F"]},
                            "Choices": { 
                                "type": "array",
                                "items": { 
                                    "type": "object" ,
                                    "properties": {
                                        "Choice": { "type": "string" },
                                        "Letter": { "type": "string",  "enum": ["A", "B", "C", "D", "E", "F"]}
                                    }
                                } 
                            }
                        }
                    }
                },
                "QuizTitle": {
                    "type" : "string"
                }
            }
        };
    }
}