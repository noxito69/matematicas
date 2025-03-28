document.addEventListener('DOMContentLoaded', function() {
    const solveBtn = document.getElementById('solve-btn');
    const equationInput = document.getElementById('equation');
    const stepsContainer = document.getElementById('steps');
    
    solveBtn.addEventListener('click', solveDifferentialEquation);
    
    // Función para renderizar MathJax después de actualizar el contenido
    function renderMathJax() {
        if (window.MathJax) {
            MathJax.typesetPromise();
        }
    }
    
    function solveDifferentialEquation() {
        // Limpiar solución anterior
        stepsContainer.innerHTML = '';
        
        const equationStr = equationInput.value.trim();
        
        if (!equationStr) {
            showError('Por favor ingresa una ecuación diferencial.');
            return;
        }
        
        try {
            // Verificar el formato básico de la ecuación
            if (!equationStr.includes('dy/dx') && !equationStr.includes('dy/dx')) {
                showError('La ecuación debe contener \(\\frac{dy}{dx}\).');
                return;
            }
            
            // Separar en LHS y RHS
            const parts = equationStr.split('=');
            if (parts.length !== 2) {
                showError('Formato de ecuación inválido. Debe ser de la forma \(\\frac{dy}{dx} = f(x,y)\)');
                return;
            }
            
            const lhs = parts[0].trim();
            const rhs = parts[1].trim();
            
            // Verificar que el LHS sea dy/dx
            if (lhs !== 'dy/dx' && lhs !== 'dy/dx') {
                showError('El lado izquierdo debe ser \(\\frac{dy}{dx}\).');
                return;
            }
            
            addStep('Ecuación original:', `\\[ ${lhs} = ${convertToTeX(rhs)} \\]`);
            
            // Paso 1: Separar variables
            const separated = separateVariables(rhs);
            if (!separated.success) {
                showError('No se pudo separar variables. La ecuación puede no ser separable.');
                return;
            }
            
            addStep('Variables separadas:', 
                   `\\[ \\frac{dy}{${convertToTeX(separated.yExpr)}} = ${convertToTeX(separated.xExpr)} \\, dx \\]`);
            
            // Paso 2: Integrar ambos lados
            const yIntegral = integrate(separated.yExpr, 'y');
            const xIntegral = integrate(separated.xExpr, 'x');
            
            addStep('Integral del lado izquierdo:', 
                   `\\[ \\int \\frac{dy}{${convertToTeX(separated.yExpr)}} = ${convertToTeX(yIntegral)} \\]`);
            
            addStep('Integral del lado derecho:', 
                   `\\[ \\int ${convertToTeX(separated.xExpr)} \\, dx = ${convertToTeX(xIntegral)} \\]`);
            
            // Paso 3: Solución general
            const solution = `${convertToTeX(yIntegral)} = ${convertToTeX(xIntegral)} + C`;
            addStep('Solución general:', `\\[ ${solution} \\]`, true);
            
            // Renderizar MathJax después de añadir todo el contenido
            renderMathJax();
            
        } catch (error) {
            showError(`Error al procesar la ecuación: ${error.message}`);
            console.error(error);
        }
    }
    
    // Función para convertir expresiones a formato TeX
    function convertToTeX(expr) {
        // Reemplazar operadores y funciones
        let texExpr = expr
            .replace(/\//g, '}{') // Fracciones
            .replace(/\^/g, '^')   // Exponentes
            .replace(/\*/g, ' \\cdot ') // Multiplicación
            .replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}') // Raíces cuadradas
            .replace(/ln\(([^)]+)\)/g, '\\ln\\left($1\\right)') // Logaritmos naturales
            .replace(/log\(([^)]+)\)/g, '\\log\\left($1\\right)'); // Logaritmos
            
        // Si contiene fracciones, agregar el entorno \frac
        if (texExpr.includes('}{')) {
            texExpr = `\\frac{${texExpr}}`;
        }
        
        return texExpr;
    }
    
    function separateVariables(expr) {
        try {
            // Parsear la expresión
            const node = math.parse(expr);
            
            // Verificar si es una fracción
            if (node.type === 'OperatorNode' && node.op === '/') {
                const numerator = node.args[0].toString();
                const denominator = node.args[1].toString();
                
                // Verificar si el numerador puede factorizarse en términos de y
                const numeratorNode = math.parse(numerator);
                let yFactors = [];
                let xFactors = [];
                
                if (numeratorNode.type === 'OperatorNode' && (numeratorNode.op === '+' || numeratorNode.op === '-')) {
                    // Buscar términos comunes
                    for (const term of numeratorNode.args) {
                        if (term.toString().includes('y')) {
                            yFactors.push(term.toString());
                        } else {
                            xFactors.push(term.toString());
                        }
                    }
                    
                    if (yFactors.length > 0) {
                        // Reconstruir expresiones
                        const yExpr = yFactors.map(f => `(${f})`).join(' + ');
                        const xExpr = xFactors.length > 0 ? xFactors.map(f => `(${f})`).join(' + ') : '1';
                        
                        // Crear expresión separada
                        const newYExpr = yExpr.replace(/y/g, '1');
                        const newXExpr = `${xExpr} / (${denominator})`;
                        
                        return {
                            success: true,
                            yExpr: `(${newYExpr})`,
                            xExpr: newXExpr
                        };
                    }
                }
                
                // Si no se pudo factorizar, intentar separar de otra forma
                if (numerator.includes('y') && !denominator.includes('y')) {
                    const newYExpr = numerator.replace(/y/g, '1');
                    const newXExpr = `1 / (${denominator})`;
                    
                    return {
                        success: true,
                        yExpr: `(${newYExpr})`,
                        xExpr: newXExpr
                    };
                }
            }
            
            // Si no es una fracción, buscar términos con y
            if (node.toString().includes('y')) {
                const terms = node.toString().split(/(?=[+-])/);
                let yTerms = [];
                let xTerms = [];
                
                for (const term of terms) {
                    if (term.includes('y')) {
                        yTerms.push(term);
                    } else {
                        xTerms.push(term);
                    }
                }
                
                if (yTerms.length > 0) {
                    const yExpr = yTerms.join('').replace(/y/g, '1');
                    const xExpr = xTerms.length > 0 ? xTerms.join('') : '0';
                    
                    return {
                        success: true,
                        yExpr: `(${yExpr})`,
                        xExpr: `(${xExpr})`
                    };
                }
            }
            
            return { success: false };
        } catch (error) {
            console.error('Error al separar variables:', error);
            return { success: false };
        }
    }
    
    function integrate(expr, variable) {
        try {
            // Usar math.js para integrar
            const integral = math.integrate(expr, variable);
            
            // Simplificar el resultado
            const simplified = math.simplify(integral);
            
            return simplified.toString();
        } catch (error) {
            console.error('Error al integrar:', error);
            return `\\int ${expr} \\, d${variable}`;
        }
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