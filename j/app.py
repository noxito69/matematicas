from flask import Flask, request, jsonify
from flask_cors import CORS
from sympy import symbols, integrate, sympify

app = Flask(__name__)
CORS(app)  # Habilitar CORS para todas las rutas

@app.route('/integrate', methods=['POST'])
def integrate_expression():
    data = request.json
    expr = data.get('expression')
    variable = data.get('variable')

    try:
        # Definir la variable simbólica
        var = symbols(variable)
        # Convertir la expresión a un formato simbólico
        symbolic_expr = sympify(expr)
        # Calcular la integral
        result = integrate(symbolic_expr, var)
        return jsonify({'result': str(result)})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)