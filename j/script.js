document.getElementById('solve-btn').addEventListener('click', solveDifferentialEquation);

async function solveDifferentialEquation() {
    const equationInput = document.getElementById('equation').value.trim();
    const stepsDiv = document.getElementById('steps');
    const solutionDiv = document.getElementById('solution');
    
    // Limpiar resultados anteriores
    stepsDiv.innerHTML = '';
    solutionDiv.innerHTML = '';
    
    if (!equationInput) {
        alert('Por favor ingresa una ecuación diferencial');
        return;
    }
    
    try {
        // Paso 1: Verificar y parsear la ecuación
        addStep(stepsDiv, "Paso 1: Ecuación original", equationInput);
        
        // Separar en LHS y RHS
        const parts = equationInput.split('=');
        if (parts.length !== 2) {
            throw new Error('La ecuación debe tener el formato dy/dx = f(x,y)');
        }
        
        const lhs = parts[0].trim();
        const rhs = parts[1].trim();
        
        // Verificar que el LHS sea dy/dx
        if (!lhs.match(/d[ydx]\/d[ydx]/)) {
            throw new Error('El lado izquierdo debe ser una derivada (dy/dx o dx/dy)');
        }
        
        // Paso 2: Simplificar la ecuación
        const simplified = math.simplify(rhs);
        addStep(stepsDiv, "Paso 2: Simplificar la ecuación", `dy/dx = ${simplified.toString()}`);
        
        // Paso 3: Intentar separar variables
        const depVar = 'y'; // Variable dependiente
        const indepVar = 'x'; // Variable independiente
        let separated;
        try {
            separated = trySeparateVariables(simplified.toString(), depVar, indepVar);
        } catch (e) {
            throw new Error('No se pudo separar las variables automáticamente. Asegúrate de que la ecuación sea separable.');
        }
        
        addStep(stepsDiv, "Paso 3: Separar variables", 
               `${separated.gExpr} d${depVar} = ${separated.hExpr} d${indepVar}`);
        
        // Paso 4: Integrar ambos lados
        const gIntegral = await integrate(separated.gExpr, depVar);
        const hIntegral = await integrate(separated.hExpr, indepVar);
        
        addStep(stepsDiv, "Paso 4: Integrar ambos lados", 
               `∫(${separated.gExpr}) d${depVar} = ∫(${separated.hExpr}) d${indepVar}`);
        addStep(stepsDiv, "Resultado de las integrales", 
               `${gIntegral} = ${hIntegral} + C`);
        
        // Paso 5: Mostrar solución general
        const finalSolution = `${gIntegral} = ${hIntegral} + C`;
        addStep(stepsDiv, "Paso 5: Solución general", finalSolution);
        solutionDiv.textContent = `Solución general: ${finalSolution}`;
        
    } catch (error) {
        stepsDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
        solutionDiv.innerHTML = '';
    }
}

function addStep(container, title, content) {
    const stepDiv = document.createElement('div');
    stepDiv.className = 'step';
    stepDiv.innerHTML = `<strong>${title}:</strong> ${content}`;
    container.appendChild(stepDiv);
}

function addStep(container, title, content) {
    const stepDiv = document.createElement('div');
    stepDiv.className = 'step';
    stepDiv.innerHTML = `<strong>${title}:</strong> ${content}`;
    container.appendChild(stepDiv);
}

async function simplifyExpression(expr) {
    try {
        const response = await fetch('http://127.0.0.1:5000/simplify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expression: expr })
        });

        if (!response.ok) {
            throw new Error('Error al simplificar la ecuación');
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }

        return data.simplified; // Devolver la ecuación simplificada
    } catch (error) {
        throw new Error(`Error al simplificar la ecuación: ${error.message}`);
    }
}


function renderMath(container, mathExpression) {
    // Reemplazar caracteres Unicode acentuados con sus equivalentes LaTeX
    const sanitizedExpression = mathExpression
        .replace(/á/g, "\\'a")
        .replace(/é/g, "\\'e")
        .replace(/í/g, "\\'i")
        .replace(/ó/g, "\\'o")
        .replace(/ú/g, "\\'u")
        .replace(/ñ/g, "\\~n")
        .replace(/\*\*/g, '^'); // Reemplazar ** por ^ para potencias

    // Renderizar la expresión matemática usando KaTeX
    katex.render(sanitizedExpression, container, {
        throwOnError: false
    });
}

function addStep(container, title, content) {
    const stepDiv = document.createElement('div');
    stepDiv.className = 'step';
    stepDiv.innerHTML = `<strong>${title}:</strong><br>`;
    
    const mathContainer = document.createElement('span');
    renderMath(mathContainer, content);
    stepDiv.appendChild(mathContainer);
    
    container.appendChild(stepDiv);
}

function trySeparateVariables(expr, depVar, indepVar) {
    try {
        // Simplificar la expresión inicial
        const simplified = math.simplify(expr);

        // Expandir el numerador y simplificar la fracción
        const expanded = math.simplify(math.expand(simplified));

        // Convertir la expresión expandida en un árbol de nodos para análisis más detallado
        const parsed = math.parse(expanded.toString());

        // Inicializar expresiones para g(y) y h(x)
        let gExpr = '1'; // Términos dependientes de y
        let hExpr = '1'; // Términos dependientes de x

        // Función recursiva para analizar nodos
        function analyzeNode(node) {
            if (node.type === 'OperatorNode' && node.op === '+') {
                // Si es una suma, analizar cada término
                node.args.forEach(analyzeNode);
            } else if (node.type === 'OperatorNode' && node.op === '*') {
                // Si es un producto, analizar cada término
                node.args.forEach(analyzeNode);
            } else if (node.type === 'OperatorNode' && node.op === '/') {
                // Si es una división, manejar numerador y denominador
                const [numerator, denominator] = node.args;
                analyzeNode(numerator); // Procesar numerador
                if (denominator.toString().includes(depVar)) {
                    gExpr = `${gExpr} / (${denominator})`;
                } else if (denominator.toString().includes(indepVar)) {
                    hExpr = `${hExpr} / (${denominator})`;
                } else {
                    hExpr = `${hExpr} / (${denominator})`; // Asumir constante
                }
            } else if (node.toString().includes(depVar) && !node.toString().includes(indepVar)) {
                // Si el término depende solo de depVar
                gExpr = gExpr === '1' ? node.toString() : `${gExpr} * (${node})`;
            } else if (node.toString().includes(indepVar) && !node.toString().includes(depVar)) {
                // Si el término depende solo de indepVar
                hExpr = hExpr === '1' ? node.toString() : `${hExpr} * (${node})`;
            } else if (!node.toString().includes(depVar) && !node.toString().includes(indepVar)) {
                // Si es una constante, asignarla a h(x)
                hExpr = hExpr === '1' ? node.toString() : `${hExpr} * (${node})`;
            } else {
                // Si el término es mixto, lanzar error
                throw new Error('Término mixto encontrado - ecuación no separable');
            }
        }

        // Analizar el árbol de nodos
        analyzeNode(parsed);

        // Simplificar las expresiones resultantes
        gExpr = math.simplify(gExpr).toString();
        hExpr = math.simplify(hExpr).toString();

        return { gExpr, hExpr };
    } catch (e) {
        throw new Error('No se pudo separar las variables automáticamente');
    }
}

async function integrate(expr, variable) {
    try {
        // Casos especiales para integrales comunes
        if (expr === `1/${variable}`) {
            return `ln|${variable}|`; // Integral de 1/x
        } else if (expr === `sin(${variable})`) {
            return `-cos(${variable})`; // Integral de sin(x)
        } else if (expr === `cos(${variable})`) {
            return `sin(${variable})`; // Integral de cos(x)
        } else if (expr === `e^${variable}` || expr === `exp(${variable})`) {
            return `e^${variable}`; // Integral de e^x
        } else if (expr === `${variable}^n` && expr.includes('n')) {
            const n = parseFloat(expr.split('^')[1]);
            if (n !== -1) {
                return `${variable}^${n + 1} / ${n + 1}`;
            }
        }

        // Usar math.js para integrales más generales
        const node = math.parse(expr);
        const integral = math.simplify(math.integrate(node, variable).toString());
        return integral;
    } catch (e) {
        // Si math.js falla, usar el backend SymPy
        try {
            const response = await fetch('http://127.0.0.1:5000/integrate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expression: expr, variable: variable })
            });

            if (!response.ok) {
                throw new Error('Error al calcular la integral con SymPy');
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            return data.result;
        } catch (backendError) {
            // Si SymPy también falla, devolver la integral simbólica
            return `∫ ${expr} d${variable}`;
        }
    }
}