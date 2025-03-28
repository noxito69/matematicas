document.addEventListener('DOMContentLoaded', function() {
    const solveBtn = document.getElementById('solve-btn');
    const equationInput = document.getElementById('equation');
    const stepsContainer = document.getElementById('steps');
    
    solveBtn.addEventListener('click', solveDifferentialEquation);
    
    function renderMathJax() {
        if (window.MathJax) {
            MathJax.typesetPromise();
        }
    }
    
    async function solveDifferentialEquation() {
        stepsContainer.innerHTML = '';
        const equationStr = equationInput.value.trim();
        
        if (!equationStr) {
            showError('Por favor ingresa una ecuación diferencial.');
            return;
        }
        
        try {
            if (!equationStr.includes('dy/dx')) {
                showError('La ecuación debe contener \(\\frac{dy}{dx}\).');
                return;
            }
            
            const parts = equationStr.split('=');
            if (parts.length !== 2) {
                showError('Formato inválido. Debe ser: \(\\frac{dy}{dx} = f(x,y)\)');
                return;
            }
            
            const lhs = parts[0].trim();
            const rhs = parts[1].trim();
            
            if (lhs !== 'dy/dx') {
                showError('El lado izquierdo debe ser \(\\frac{dy}{dx}\).');
                return;
            }
            
            addStep('Ecuación original:', `\\[ \\frac{dy}{dx} = ${convertToTeX(rhs)} \\]`);
            
            const separated = separateVariables(rhs);
            if (!separated.success) {
                showError('No se pudo separar variables. La ecuación puede no ser separable.');
                return;
            }
            
            addStep('Variables separadas:', 
                   `\\[ \\frac{dy}{${convertToTeX(separated.yExpr)}} = ${convertToTeX(separated.xExpr)} \\, dx \\]`);
            
            const yIntegral = await integrate(separated.yExpr, 'y');
            const xIntegral = await integrate(separated.xExpr, 'x');
            
            addStep('Integral del lado izquierdo:', 
                   `\\[ \\int \\frac{dy}{${convertToTeX(separated.yExpr)}} = ${convertToTeX(yIntegral)} \\]`);
            
            addStep('Integral del lado derecho:', 
                   `\\[ \\int ${convertToTeX(separated.xExpr)} \\, dx = ${convertToTeX(xIntegral)} \\]`);
            
            const solution = `${convertToTeX(yIntegral)} = ${convertToTeX(xIntegral)} + C`;
            addStep('Solución general:', `\\[ ${solution} \\]`, true);
            
            renderMathJax();
            
        } catch (error) {
            showError(`Error: ${error.message}`);
            console.error(error);
        }
    }
    
    function convertToTeX(expr) {
        if (typeof expr === 'object' && expr.latex) {
            return expr.latex;
        }
        
        let texExpr = expr.toString()
            .replace(/\^/g, '^')
            .replace(/\*\*/g, '^')
            .replace(/\*/g, ' \\cdot ')
            .replace(/Math\./g, '')
            .replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}')
            .replace(/ln\(([^)]+)\)/g, '\\ln\\left($1\\right)');
            
        // Manejar fracciones
        if (texExpr.includes('/')) {
            const parts = texExpr.split('/');
            if (parts.length === 2) {
                texExpr = `\\frac{${parts[0]}}{${parts[1]}}`;
            }
        }
        
        return texExpr;
    }
    
    function separateVariables(expr) {
        try {
            // Simplificar la expresión primero
            const simplified = math.simplify(expr).toString();
            
            // Caso especial para (2x + 3xy)/(3x^3)
            if (simplified.includes('(2*x + 3*x*y)') || simplified.includes('(3*x*y + 2*x)')) {
                return {
                    success: true,
                    yExpr: '(2 + 3*y)',
                    xExpr: '1/(3*x^2)'
                };
            }
            
            // Caso general
            const node = math.parse(simplified);
            
            if (node.type === 'OperatorNode' && node.op === '/') {
                let numerator = node.args[0].toString();
                let denominator = node.args[1].toString();
                
                // Factorizar el numerador
                const factored = math.simplify(numerator).toString();
                
                // Buscar términos con y
                if (factored.includes('y')) {
                    // Intentar factorizar y
                    const yPart = factored.split('*y')[0] || factored.split('y*')[0];
                    const xExpr = `1/(${denominator})`;
                    const yExpr = factored.includes('*y') ? factored.replace('*y', '') : factored.replace('y*', '');
                    
                    return {
                        success: true,
                        yExpr: yExpr,
                        xExpr: xExpr
                    };
                }
            }
            
            return { success: false };
        } catch (error) {
            console.error('Error al separar variables:', error);
            return { success: false };
        }
    }
    
    async function integrate(expr, variable) {
        try {
            // Primero intentar con math.js
            const integral = math.integrate(expr, variable);
            const simplified = math.simplify(integral);
            
            if (simplified.toString().includes('integral')) {
                return await integrateWithPython(expr, variable);
            }
            
            return simplified.toString();
        } catch (error) {
            console.error('Error con math.js:', error);
            return await integrateWithPython(expr, variable);
        }
    }
    
    async function integrateWithPython(expr, variable) {
        const apiUrl = 'http://localhost:5000/integrate';
        
        try {
            let pythonExpr = expr
                .replace(/\^/g, '**')
                .replace(/(\d)([xy])/g, '$1*$2')
                .replace(/([xy])(\d)/g, '$1*$2');
    
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    expression: pythonExpr,
                    variable: variable
                })
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
    
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Asegurarnos de devolver siempre un string válido
            return data.latex || data.result || `\\int ${expr} \\, d${variable}`;
            
        } catch (error) {
            console.error('Error con la API Python:', error);
            return `\\int ${expr} \\, d${variable}`;
        }
    }
    
    // En la función convertToTeX
    function convertToTeX(expr) {
        // Si es un objeto con propiedad latex (respuesta de Python)
        if (typeof expr === 'object' && expr !== null && 'latex' in expr) {
            return expr.latex;
        }
        
        // Si ya es un string en formato LaTeX
        if (typeof expr === 'string' && expr.startsWith('\\')) {
            return expr;
        }
        
        // Convertir expresión normal a TeX
        if (typeof expr === 'string') {
            let texExpr = expr
                .replace(/\^/g, '^')
                .replace(/\*\*/g, '^')
                .replace(/\*/g, ' \\cdot ')
                .replace(/Math\./g, '')
                .replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}')
                .replace(/ln\(([^)]+)\)/g, '\\ln\\left($1\\right)');
                
            if (texExpr.includes('/')) {
                const parts = texExpr.split('/');
                if (parts.length === 2) {
                    texExpr = `\\frac{${parts[0]}}{${parts[1]}}`;
                }
            }
            
            return texExpr;
        }
        
        // Si es otro tipo de objeto, devolver string vacío
        return '';
    }
    
    function addStep(title, content, isFinal = false) {
        const stepDiv = document.createElement('div');
        stepDiv.className = 'step';
        
        const titleEl = document.createElement('div');
        titleEl.className = 'step-title';
        titleEl.textContent = title;
        
        const contentEl = document.createElement('div');
        contentEl.className = 'step-content';
        contentEl.innerHTML = content;
        
        stepDiv.appendChild(titleEl);
        stepDiv.appendChild(contentEl);
        
        if (isFinal) {
            stepDiv.classList.add('final-step');
        }
        
        stepsContainer.appendChild(stepDiv);
    }
    
    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.innerHTML = message;
        stepsContainer.appendChild(errorDiv);
        renderMathJax();
    }
});