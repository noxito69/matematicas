document.getElementById('solve-btn').addEventListener('click', solveDifferentialEquation);

function solveDifferentialEquation() {
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
        
        // Determinar variable dependiente e independiente
        const [numerator, denominator] = lhs.split('/').map(s => s.trim());
        const depVar = numerator.replace('d', '');
        const indepVar = denominator.replace('d', '');
        
        addStep(stepsDiv, `Paso 2: Identificar variables`, 
               `Variable dependiente: ${depVar}, Variable independiente: ${indepVar}`);
        
        // Paso 3: Separar variables
        let separated;
        try {
            // Intentar separar variables automáticamente
            separated = trySeparateVariables(rhs, depVar, indepVar);
        } catch (e) {
            throw new Error('No se pudo separar las variables automáticamente. Asegúrate de que la ecuación sea separable.');
        }
        
        addStep(stepsDiv, "Paso 3: Separar variables", 
               `${separated.gExpr} d${depVar} = ${separated.hExpr} d${indepVar}`);
        
        // Paso 4: Integrar ambos lados
        const gIntegral = integrate(separated.gExpr, depVar);
        const hIntegral = integrate(separated.hExpr, indepVar);
        
        addStep(stepsDiv, "Paso 4: Integrar ambos lados", 
               `\\int ${separated.gExpr} \\, d${depVar} = \\int ${separated.hExpr} \\, d${indepVar}`);
        addStep(stepsDiv, "Resultado de las integrales", 
               `${gIntegral} = ${hIntegral} + C`);
        
        // Paso 5: Mostrar solución
        renderMath(solutionDiv, `Solución implícita: ${gIntegral} = ${hIntegral} + C`);
        
    } catch (error) {
        stepsDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
        solutionDiv.textContent = '';
    }
}


function renderMath(container, mathExpression) {
    // Renderizar la expresión matemática usando KaTeX
    katex.render(mathExpression, container, {
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
    // Simplificar la expresión
    const simplified = math.simplify(expr);

    try {
        // Convertir la expresión en un árbol de nodos para análisis más detallado
        const parsed = math.parse(simplified.toString());

        // Inicializar expresiones para g(y) y h(x)
        let gExpr = '1';
        let hExpr = '1';

        // Función recursiva para analizar nodos
        function analyzeNode(node) {
            if (node.type === 'OperatorNode' && node.op === '*') {
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

function integrate(expr, variable) {
    try {
        // Usar math.js para integrar
        const node = math.parse(expr);
        let integral;
        
        // Manejar casos especiales
        if (expr === `1/${variable}`) {
            integral = `ln|${variable}|`;
        } else {
            integral = math.simplify(math.integrate(node, variable).toString());
        }
        
        return integral;
    } catch (e) {
        // Si math.js no puede integrar, devolver la integral simbólica
        return `∫ ${expr} d${variable}`;
    }
}