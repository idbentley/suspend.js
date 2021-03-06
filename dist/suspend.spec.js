(function() {
  describe("The evaluator module", function() {
    var evaluator;
    evaluator = void 0;
    beforeEach(function() {
      return evaluator = new Evaluator();
    });
    afterEach(function() {
      var iframe;
      iframe = evaluator.getGlobal("frameElement");
      return iframe.parentElement.removeChild(iframe);
    });
    it("creates an iframe to evaluate code in", function() {
      var iframe, isIFrame;
      iframe = evaluator.getGlobal("frameElement");
      isIFrame = iframe instanceof HTMLIFrameElement || iframe instanceof evaluator.getGlobal("HTMLIFrameElement");
      expect(isIFrame).toBe(true);
      expect(iframe.height).toEqual("0");
      expect(iframe.width).toEqual("0");
      return expect(iframe.style.visibility).toEqual("hidden");
    });
    describe("when compiling", function() {
      var getExpressionBytecode, getStatementsBytecode, tempName;
      beforeEach(function() {
        return this.addMatchers({
          toHaveSameAST: function(expected) {
            var act, actual, actualAST, exp, expectedAST, i, _i, _len, _ref,
              _this = this;
            actual = this.actual;
            this.message = function() {
              return "Expected " + _this.actual + " to have the same AST as " + expected;
            };
            if ((typeof this.actual === (_ref = typeof expected) && _ref === 'string')) {
              actual = [actual];
              expected = [expected];
            }
            if (Array.isArray(actual) && Array.isArray(expected)) {
              if (actual.length === expected.length) {
                for (i = _i = 0, _len = actual.length; _i < _len; i = ++_i) {
                  act = actual[i];
                  exp = expected[i];
                  actualAST = esprima.parse(act).body;
                  expectedAST = esprima.parse(exp).body;
                  if (!this.env.equals_(actualAST, expectedAST)) {
                    return false;
                  }
                }
                return true;
              }
            }
            return false;
          },
          toBeFunctionDef: function(name, params, body, tempVar) {
            var bodyInstructions, functionBytecode, message;
            message = null;
            if (!this.env.equals_(this.actual, jasmine.any(Evaluator.Function))) {
              message = ("Expected " + this.actual + " to be an instance of ") + "the evaluator's Function class";
            } else if (this.actual.name !== name) {
              message = ("Expected function to have name " + name + ", ") + ("instead had name " + this.actual.name);
            } else if (!this.env.equals_(this.actual.params, params)) {
              message = ("Expected function to have params " + params + ", ") + ("instead had params " + this.actual.params);
            } else if (this.actual.tempVar !== tempVar) {
              message = ("Expected function to be stored in variable " + tempVar + ", ") + ("instead stored in " + this.actual.tempVar);
            } else {
              functionBytecode = getExpressionBytecode("(function () {" + body + "})");
              bodyInstructions = functionBytecode.preInstructions[0].body;
              if (!this.env.equals_(this.actual.body, bodyInstructions)) {
                message = "Expected function body to have same instructions as " + body;
              }
            }
            this.message = function() {
              return message;
            };
            return message === null;
          },
          toBeFunctionCall: function(callee, args, tempVar, isObjectCreation) {
            var message, targetClass;
            if (isObjectCreation == null) {
              isObjectCreation = false;
            }
            if (!(Array.isArray(callee) || isObjectCreation)) {
              callee = [null, callee];
            }
            targetClass = isObjectCreation ? Evaluator.NewObject : Evaluator.FunctionCall;
            message = null;
            if (!this.env.equals_(this.actual, jasmine.any(targetClass))) {
              message = "Expected " + this.actual + " to be instance of " + targetClass + ".";
            } else if (!this.env.equals_(this.actual.callee, callee)) {
              message = ("Expected to be calling " + (jasmine.pp(callee)) + ", ") + ("actually calling " + (jasmine.pp(this.actual.callee)) + ".");
            } else if (this.actual.tempVar !== tempVar) {
              message = ("Expected function call result to be stored in " + tempVar + ", ") + ("actually stored in " + this.actual.tempVar + ".");
            } else if (this.actual.args.length !== args.length) {
              message = ("Calling function with " + this.actual.args.length + " arguments, ") + ("expected to be calling with " + args.length + " arguments.");
            } else {
              expect(this.actual.args).toHaveSameAST(args);
            }
            this.message = function() {
              return message;
            };
            return message === null;
          }
        });
      });
      getExpressionBytecode = function(expressionString) {
        var body;
        body = esprima.parse(expressionString).body;
        expect(body.length).toEqual(1);
        expect(body[0].type).toEqual("ExpressionStatement");
        return Evaluator.compileExpression(body[0].expression);
      };
      getStatementsBytecode = function(statementsString) {
        var ast;
        ast = esprima.parse(statementsString).body;
        return Evaluator.compileStatements(ast);
      };
      tempName = function(index) {
        return "$__temp__[" + index + "]";
      };
      describe("expression bytecode", function() {
        it("converts non-function calls to a string", function() {
          var bytecode, e, expression, original, _i, _len, _results;
          original = ["'my string'", "true", "null", "123.45", "1.0e2", "/regex/", "$my_id_", "this", "[1, true, 'hi', foo]", "({a: 1})", "({msg: 'hello', arr: [1,2,3], obj: {foo: 'bar'}})", "1, 2, red, blue", "-a", "+5", "!hello", "~true", "! 'hey'", "typeof obj", "void 'hi'", "delete foo", "a in b", "'0' == false", "foo = 12", "i += 4", "a++", "b--", "++c", "--d", "foo[bar]", "arr[0]", "obj['key']", "(1 + 2) * 3", "a + (b = 2)"];
          _results = [];
          for (_i = 0, _len = original.length; _i < _len; _i++) {
            expression = original[_i];
            try {
              bytecode = getExpressionBytecode(expression);
              expect(bytecode.preInstructions).toEqual([]);
              _results.push(expect(bytecode.expression).toHaveSameAST(expression));
            } catch (_error) {
              e = _error;
              throw new Error("Failed to compile " + expression + ". Error is: " + (e.toString()));
            }
          }
          return _results;
        });
        it("can define functions", function() {
          var body, bytecode, original, temp;
          temp = tempName(0);
          body = "var a = {hi: 'hello'}; a.b = 123; var b = 'foo'";
          original = "(function () {" + body + "})";
          bytecode = getExpressionBytecode(original);
          expect(bytecode.preInstructions.length).toEqual(1);
          expect(bytecode.preInstructions[0]).toBeFunctionDef(null, [], body, temp);
          expect(bytecode.expression).toEqual(temp);
          original = "(function foo(a, b) {a + b})";
          bytecode = getExpressionBytecode(original);
          expect(bytecode.preInstructions.length).toEqual(1);
          expect(bytecode.preInstructions[0]).toBeFunctionDef("foo", ["a", "b"], "a + b", temp);
          return expect(bytecode.expression).toEqual(temp);
        });
        it("can call functions", function() {
          var bytecode, temp;
          temp = tempName(0);
          bytecode = getExpressionBytecode("a.b.c()");
          expect(bytecode.preInstructions.length).toEqual(1);
          expect(bytecode.preInstructions[0]).toBeFunctionCall(["a.b", "'c'"], [], temp);
          expect(bytecode.expression).toEqual(temp);
          bytecode = getExpressionBytecode("arr[i]()");
          expect(bytecode.preInstructions.length).toEqual(1);
          expect(bytecode.preInstructions[0]).toBeFunctionCall(["arr", "i"], [], temp);
          expect(bytecode.expression).toEqual(temp);
          bytecode = getExpressionBytecode("func(foo, bar)");
          expect(bytecode.preInstructions.length).toEqual(1);
          expect(bytecode.preInstructions[0]).toBeFunctionCall("func", ["foo", "bar"], temp);
          return expect(bytecode.expression).toEqual(temp);
        });
        it("can create new objects", function() {
          var bytecode, temp;
          temp = tempName(0);
          bytecode = getExpressionBytecode("new foo(a, b, c)");
          expect(bytecode.preInstructions.length).toEqual(1);
          expect(bytecode.preInstructions[0]).toBeFunctionCall("foo", ["a", "b", "c"], temp, true);
          return expect(bytecode.expression).toEqual(temp);
        });
        it("handles multiple pre-instructions", function() {
          var bytecode, t0, t1;
          t0 = tempName(0);
          t1 = tempName(1);
          bytecode = getExpressionBytecode("[foo(), bar()]");
          expect(bytecode.preInstructions.length).toEqual(2);
          expect(bytecode.preInstructions[0]).toBeFunctionCall("foo", [], t0);
          expect(bytecode.preInstructions[1]).toBeFunctionCall("bar", [], t1);
          expect(bytecode.expression).toHaveSameAST("[" + t0 + ", " + t1 + "]");
          bytecode = getExpressionBytecode("obj.baz(a).garply(b).length");
          expect(bytecode.preInstructions.length).toEqual(2);
          expect(bytecode.preInstructions[0]).toBeFunctionCall(["obj", "'baz'"], ["a"], t0);
          expect(bytecode.preInstructions[1]).toBeFunctionCall([t0, "'garply'"], ["b"], t1);
          expect(bytecode.expression).toEqual("" + t1 + ".length");
          bytecode = getExpressionBytecode("outer(inner())");
          expect(bytecode.preInstructions.length).toEqual(2);
          expect(bytecode.preInstructions[0]).toBeFunctionCall("inner", [], t0);
          expect(bytecode.preInstructions[1]).toBeFunctionCall("outer", [t0], t1);
          return expect(bytecode.expression).toEqual(t1);
        });
        it("desugars short circuiting logical expressions", function() {
          var bytecode, ifStatement, t0, t1, temp;
          bytecode = getExpressionBytecode('a && b');
          temp = tempName(0);
          expect(bytecode.preInstructions.length).toEqual(2);
          expect(bytecode.preInstructions[0]).toHaveSameAST("" + temp + " = a");
          ifStatement = bytecode.preInstructions[1];
          expect(ifStatement).toEqual(jasmine.any(Evaluator.If));
          expect(ifStatement.condition).toHaveSameAST(temp);
          expect(ifStatement.thenCase).toHaveSameAST(["" + temp + " = b"]);
          expect(ifStatement.elseCase).toEqual([]);
          expect(bytecode.expression).toEqual(temp);
          bytecode = getExpressionBytecode('f() || g()');
          t0 = tempName(0);
          t1 = tempName(1);
          expect(bytecode.preInstructions.length).toEqual(3);
          expect(bytecode.preInstructions[0]).toBeFunctionCall('f', [], t1);
          expect(bytecode.preInstructions[1]).toHaveSameAST("" + t0 + " = " + t1);
          ifStatement = bytecode.preInstructions[2];
          expect(ifStatement).toEqual(jasmine.any(Evaluator.If));
          expect(ifStatement.condition).toHaveSameAST("!" + t0);
          expect(ifStatement.thenCase.length).toEqual(2);
          expect(ifStatement.thenCase[0]).toBeFunctionCall('g', [], t0);
          expect(ifStatement.thenCase[1]).toHaveSameAST("" + t0 + " = " + t0);
          expect(ifStatement.elseCase).toEqual([]);
          return expect(bytecode.expression).toEqual(t0);
        });
        return it("desugars ternary expressions", function() {
          var bytecode, ifStatement, t0, t1;
          bytecode = getExpressionBytecode('a() ? b() : c()');
          t0 = tempName(0);
          t1 = tempName(1);
          expect(bytecode.preInstructions.length).toEqual(2);
          expect(bytecode.preInstructions[0]).toBeFunctionCall('a', [], t1);
          ifStatement = bytecode.preInstructions[1];
          expect(ifStatement).toEqual(jasmine.any(Evaluator.If));
          expect(ifStatement.condition).toHaveSameAST(t1);
          expect(ifStatement.thenCase.length).toEqual(2);
          expect(ifStatement.thenCase[0]).toBeFunctionCall('b', [], t0);
          expect(ifStatement.thenCase[1]).toHaveSameAST("" + t0 + " = " + t0);
          expect(ifStatement.elseCase.length).toEqual(2);
          expect(ifStatement.elseCase[0]).toBeFunctionCall('c', [], t0);
          expect(ifStatement.elseCase[1]).toHaveSameAST("" + t0 + " = " + t0);
          return expect(bytecode.expression).toEqual(t0);
        });
      });
      return describe("statement bytecode", function() {
        var expectStatementsEqual;
        expectStatementsEqual = function(program, expectedStatements, expectedVariables, expectedFunctions) {
          var actualFunc, bytecode, c, compiled, exp, i, _i, _j, _len, _len1, _ref, _results;
          expectedVariables = expectedVariables || [];
          expectedFunctions = expectedFunctions || [];
          bytecode = getStatementsBytecode(program);
          compiled = bytecode.instructions;
          expect(bytecode.declaredVariables.sort()).toEqual(expectedVariables.sort());
          expect(bytecode.declaredFunctions.length).toEqual(expectedFunctions.length);
          _ref = bytecode.declaredFunctions;
          for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
            actualFunc = _ref[i];
            exp = expect(actualFunc);
            exp.toBeFunctionDef.apply(exp, expectedFunctions[i]);
          }
          expect(compiled.length).toEqual(expectedStatements.length);
          _results = [];
          for (i = _j = 0, _len1 = compiled.length; _j < _len1; i = ++_j) {
            c = compiled[i];
            _results.push(expect(c).toHaveSameAST(expectedStatements[i]));
          }
          return _results;
        };
        it("ignores empty statements", function() {
          return expectStatementsEqual(";", []);
        });
        it("puts expressions in their own instruction", function() {
          return expectStatementsEqual("a; 1 + 2; foo = 'hi'", ["a", "1 + 2", "foo = 'hi'"]);
        });
        it("puts an expression's pre instructions before the instruction", function() {
          var bytecode, original, t0, t1;
          t0 = tempName(0);
          t1 = tempName(1);
          original = "var a = 5; b = f(a, g());";
          bytecode = getStatementsBytecode(original);
          expect(bytecode.declaredVariables).toEqual(["a"]);
          expect(bytecode.instructions.length).toEqual(4);
          expect(bytecode.instructions[0]).toHaveSameAST("void (a = 5)");
          expect(bytecode.instructions[1]).toBeFunctionCall("g", [], t0);
          expect(bytecode.instructions[2]).toBeFunctionCall("f", ["a", t0], t1);
          return expect(bytecode.instructions[3]).toHaveSameAST("b = " + t1);
        });
        it("extracts declared variables", function() {
          return expectStatementsEqual("a = 1; var b = 2, c; var a; b++", ["a = 1", "void (b = 2)", "b++"], ["a", "b", "c"]);
        });
        it("extracts declared functions", function() {
          var bytecode, declaredFuncs;
          bytecode = getStatementsBytecode("          obj = {msg: 'hi'};          function foo(a, b) {            a[b] = 'foo'          }          var bar = function bar() {};        ");
          expect(bytecode.declaredVariables).toEqual(["bar"]);
          declaredFuncs = bytecode.declaredFunctions;
          expect(declaredFuncs.length).toEqual(1);
          expect(declaredFuncs[0]).toBeFunctionDef("foo", ["a", "b"], "a[b] = 'foo'", null);
          expect(bytecode.instructions.length).toEqual(3);
          expect(bytecode.instructions[0]).toHaveSameAST("obj = {msg: 'hi'}");
          expect(bytecode.instructions[1]).toBeFunctionDef("bar", [], "", tempName(0));
          return expect(bytecode.instructions[2]).toHaveSameAST("void (bar = " + (tempName(0)) + ")");
        });
        it("can return values from functions", function() {
          var bytecode, func, returnInst;
          bytecode = getExpressionBytecode("(function () {return 5})");
          func = bytecode.preInstructions[0];
          returnInst = func.body.instructions[0];
          expect(returnInst).toEqual(jasmine.any(Evaluator.Return));
          return expect(returnInst.value).toEqual("5");
        });
        it("flattens block statements", function() {
          return expectStatementsEqual("a = 1; {b = 2; var b, c = 3; function foo() {}}; var c = 4;", ["a = 1", "b = 2", "void (c = 3)", "void (c = 4)"], ["b", "c"], [["foo", [], "", null]]);
        });
        it("creates if statements with function scope", function() {
          var bytecode, declaredFuncs, ifStatement;
          bytecode = getStatementsBytecode("          var myval = 'hi';          if (!isHi(myval)) {            var a = 1;          } else {            var b = 2;            function inside() {}          }          function isHi(val) {return val === 'hi'}          var c = 'hello';        ");
          expect(bytecode.declaredVariables).toEqual(["myval", "a", "b", "c"]);
          declaredFuncs = bytecode.declaredFunctions;
          expect(declaredFuncs.length).toEqual(2);
          expect(declaredFuncs[0]).toBeFunctionDef("inside", [], "", null);
          expect(declaredFuncs[1]).toBeFunctionDef("isHi", ["val"], "return val === 'hi'", null);
          expect(bytecode.instructions.length).toEqual(4);
          expect(bytecode.instructions[0]).toHaveSameAST("void (myval = 'hi')");
          expect(bytecode.instructions[1]).toBeFunctionCall("isHi", ["myval"], tempName(0));
          ifStatement = bytecode.instructions[2];
          expect(ifStatement).toEqual(jasmine.any(Evaluator.If));
          expect(ifStatement.condition).toHaveSameAST("!" + (tempName(0)));
          expect(ifStatement.thenCase).toHaveSameAST(["void (a = 1)"]);
          expect(ifStatement.elseCase).toHaveSameAST(["void (b = 2)"]);
          return expect(bytecode.instructions[3]).toHaveSameAST("void (c = 'hello')");
        });
        it("handles if statements without else blocks", function() {
          var bytecode, ifStatement;
          bytecode = getStatementsBytecode("          if (predicate) {            a = 1;          }        ");
          expect(bytecode.instructions.length).toEqual(1);
          ifStatement = bytecode.instructions[0];
          expect(ifStatement.thenCase).toHaveSameAST(["a = 1"]);
          return expect(ifStatement.elseCase).toEqual([]);
        });
        it("ignores labels", function() {
          var original;
          original = "          foo:          {            a = 1;            bar: a++          }";
          return expectStatementsEqual(original, ["a = 1", "a++"]);
        });
        it("creates With blocks with function scope", function() {
          var bytecode;
          bytecode = getStatementsBytecode("          with (getEnv()) {            var a = 1;            function b () {}          }        ");
          expect(bytecode.declaredVariables).toEqual(["a"]);
          expect(bytecode.declaredFunctions.length).toEqual(1);
          expect(bytecode.declaredFunctions[0]).toBeFunctionDef("b", [], "", null);
          expect(bytecode.instructions[0]).toBeFunctionCall("getEnv", [], tempName(0));
          expect(bytecode.instructions[1]).toEqual(jasmine.any(Evaluator.With));
          return expect(bytecode.instructions[1].body).toHaveSameAST(["void (a = 1)"]);
        });
        describe("creating Switch blocks", function() {
          it("desugars case evaluation and flattens all statements", function() {
            var bytecode, firstLevel, inst, secondLevel, switchStatement, t0, t1, t2, thirdLevel;
            bytecode = getStatementsBytecode("            switch (val()) {            case first:              a = 2;              b(a);            case 'second':              a = 5;            case third():              a++;            }          ");
            t0 = tempName(0);
            t1 = tempName(1);
            t2 = tempName(2);
            expect(bytecode.instructions.length).toEqual(3);
            expect(bytecode.instructions[0]).toBeFunctionCall('val', [], t1);
            firstLevel = bytecode.instructions[1];
            expect(firstLevel).toEqual(jasmine.any(Evaluator.If));
            expect(firstLevel.condition).toHaveSameAST("" + t1 + " == first");
            expect(firstLevel.thenCase).toHaveSameAST(["" + t0 + " = 0"]);
            expect(firstLevel.elseCase.length).toEqual(1);
            secondLevel = firstLevel.elseCase[0];
            expect(secondLevel).toEqual(jasmine.any(Evaluator.If));
            expect(secondLevel.condition).toHaveSameAST("" + t1 + " == 'second'");
            expect(secondLevel.thenCase).toHaveSameAST(["" + t0 + " = 3"]);
            expect(secondLevel.elseCase.length).toEqual(2);
            expect(secondLevel.elseCase[0]).toBeFunctionCall('third', [], t2);
            thirdLevel = secondLevel.elseCase[1];
            expect(thirdLevel).toEqual(jasmine.any(Evaluator.If));
            expect(thirdLevel.condition).toHaveSameAST("" + t1 + " == " + t2);
            expect(thirdLevel.thenCase).toHaveSameAST(["" + t0 + " = 4"]);
            expect(thirdLevel.elseCase).toHaveSameAST(["" + t0 + " = null"]);
            switchStatement = bytecode.instructions[2];
            expect(switchStatement).toEqual(jasmine.any(Evaluator.Switch));
            expect(switchStatement.startPCVar).toEqual(t0);
            inst = switchStatement.instructions;
            expect(inst[0]).toHaveSameAST("a = 2");
            expect(inst[1]).toBeFunctionCall("b", ["a"], t0);
            expect(inst[2]).toHaveSameAST(t0);
            expect(inst[3]).toHaveSameAST("a = 5");
            return expect(inst[4]).toHaveSameAST("a++");
          });
          it("has function scope", function() {
            var bytecode, inst;
            bytecode = getStatementsBytecode("            switch (foo().val) {            case first:              var a = 2;            case 'second':              var b = 5;              function c(d) {e}            }          ");
            expect(bytecode.declaredVariables).toEqual(["a", "b"]);
            expect(bytecode.declaredFunctions.length).toEqual(1);
            expect(bytecode.declaredFunctions[0]).toBeFunctionDef("c", ["d"], "e", null);
            inst = bytecode.instructions;
            expect(inst.length).toEqual(3);
            expect(inst[0]).toBeFunctionCall("foo", [], tempName(1));
            expect(inst[1]).toEqual(jasmine.any(Evaluator.If));
            expect(inst[2]).toEqual(jasmine.any(Evaluator.Switch));
            return expect(inst[2].startPCVar).toEqual(tempName(0));
          });
          return it("stores a default index", function() {
            var bytecode, firstLevel, secondLevel, switchStatement, temp;
            bytecode = getStatementsBytecode("            switch (val) {            case 'foo':              a = 2;            default:              a = 4;            case 'bar':              a = 6;            }          ");
            temp = tempName(0);
            expect(bytecode.instructions.length).toEqual(2);
            firstLevel = bytecode.instructions[0];
            expect(firstLevel).toEqual(jasmine.any(Evaluator.If));
            expect(firstLevel.condition).toHaveSameAST("val == 'foo'");
            expect(firstLevel.thenCase).toHaveSameAST(["" + temp + " = 0"]);
            expect(firstLevel.elseCase.length).toEqual(1);
            secondLevel = firstLevel.elseCase[0];
            expect(secondLevel).toEqual(jasmine.any(Evaluator.If));
            expect(secondLevel.condition).toHaveSameAST("val == 'bar'");
            expect(secondLevel.thenCase).toHaveSameAST(["" + temp + " = 2"]);
            expect(secondLevel.elseCase).toHaveSameAST(["" + temp + " = 1"]);
            switchStatement = bytecode.instructions[1];
            expect(switchStatement).toEqual(jasmine.any(Evaluator.Switch));
            return expect(switchStatement.startPCVar).toEqual(temp);
          });
        });
        it("creates break statements", function() {
          var breakStatement, bytecode, switchStatement;
          bytecode = getStatementsBytecode("          switch (val) {          case 'foo':            break;          }        ");
          switchStatement = bytecode.instructions[1];
          breakStatement = switchStatement.instructions[0];
          return expect(breakStatement).toEqual(jasmine.any(Evaluator.Break));
        });
        it("does not allow break statements to have labels", function() {
          var original;
          original = "          switch (val) {          case 'foo':            lbl:break lbl;          }";
          return expect(function() {
            return getStatementsBytecode(original);
          }).toThrow("Does not support labelled breaks.");
        });
        it("creates continue statements", function() {
          var bytecode, continueStatement, whileStatement;
          bytecode = getStatementsBytecode("          while (true) {            continue;          };        ");
          whileStatement = bytecode.instructions[0];
          continueStatement = whileStatement.instructions[1];
          return expect(continueStatement).toEqual(jasmine.any(Evaluator.Continue));
        });
        it("doesn't allow labelled continues", function() {
          var original;
          original = "          lbl:          while (true) {            continue lbl;          };";
          return expect(function() {
            return getStatementsBytecode(original);
          }).toThrow("Does not support labelled continues.");
        });
        describe("creating While loops", function() {
          it("desugars it into a loop", function() {
            var bytecode, ifStatement, loopInstr;
            bytecode = getStatementsBytecode("            while (!shouldStop()) {              a = 1 + 2;              a++;            }          ");
            expect(bytecode.instructions.length).toEqual(1);
            loopInstr = bytecode.instructions[0];
            expect(loopInstr).toEqual(jasmine.any(Evaluator.Loop));
            expect(loopInstr.instructions.length).toEqual(5);
            expect(loopInstr.instructions[0]).toBeFunctionCall("shouldStop", [], tempName(0));
            ifStatement = loopInstr.instructions[1];
            expect(ifStatement).toEqual(jasmine.any(Evaluator.If));
            expect(ifStatement.condition).toHaveSameAST("!!" + (tempName(0)));
            expect(ifStatement.thenCase.length).toEqual(1);
            expect(ifStatement.thenCase[0]).toEqual(jasmine.any(Evaluator.Break));
            expect(ifStatement.elseCase).toEqual([]);
            expect(loopInstr.instructions[2]).toHaveSameAST("a = 1 + 2");
            expect(loopInstr.instructions[3]).toHaveSameAST("a++");
            return expect(loopInstr.instructions[4]).toEqual(jasmine.any(Evaluator.Continue));
          });
          return it("uses function scope", function() {
            var bytecode;
            bytecode = getStatementsBytecode("            while (true) {              var a = 1 + 2;              function b(c) {d};            }          ");
            expect(bytecode.declaredVariables).toEqual(["a"]);
            expect(bytecode.declaredFunctions.length).toEqual(1);
            return expect(bytecode.declaredFunctions[0]).toBeFunctionDef("b", ["c"], "d", null);
          });
        });
        describe("creating Do While loops", function() {
          it("unrolls one execution and desugars it into a loop", function() {
            var bytecode, ifStatement, loopInstr;
            bytecode = getStatementsBytecode("            do {              a = 1 + 2;              a++;            } while (!shouldStop());          ");
            expect(bytecode.instructions.length).toEqual(1);
            loopInstr = bytecode.instructions[0];
            expect(loopInstr).toEqual(jasmine.any(Evaluator.Loop));
            expect(loopInstr.instructions.length).toEqual(5);
            expect(loopInstr.initialPC).toEqual(2);
            expect(loopInstr.instructions[0]).toBeFunctionCall("shouldStop", [], tempName(0));
            ifStatement = loopInstr.instructions[1];
            expect(ifStatement).toEqual(jasmine.any(Evaluator.If));
            expect(ifStatement.condition).toHaveSameAST("!!" + (tempName(0)));
            expect(ifStatement.thenCase.length).toEqual(1);
            expect(ifStatement.thenCase[0]).toEqual(jasmine.any(Evaluator.Break));
            expect(ifStatement.elseCase).toEqual([]);
            expect(loopInstr.instructions[2]).toHaveSameAST("a = 1 + 2");
            expect(loopInstr.instructions[3]).toHaveSameAST("a++");
            return expect(loopInstr.instructions[4]).toEqual(jasmine.any(Evaluator.Continue));
          });
          return it("uses function scope", function() {
            var bytecode;
            bytecode = getStatementsBytecode("            do {              var a = 1 + 2;              function b(c) {d};            } while (true);          ");
            expect(bytecode.declaredVariables).toEqual(["a"]);
            expect(bytecode.declaredFunctions.length).toEqual(1);
            return expect(bytecode.declaredFunctions[0]).toBeFunctionDef("b", ["c"], "d", null);
          });
        });
        describe("creating For loops", function() {
          it("desugars it into a flat loop", function() {
            var bytecode, ifStatement, loopInstr, t0;
            bytecode = getStatementsBytecode("            for (i = initVar(); i !== lst().length; i++) {              a.push(i + 1);            }          ");
            t0 = tempName(0);
            expect(bytecode.instructions.length).toEqual(3);
            expect(bytecode.instructions[0]).toBeFunctionCall("initVar", [], t0);
            expect(bytecode.instructions[1]).toHaveSameAST("i = " + t0);
            loopInstr = bytecode.instructions[2];
            expect(loopInstr).toEqual(jasmine.any(Evaluator.Loop));
            expect(loopInstr.instructions.length).toEqual(6);
            expect(loopInstr.instructions[0]).toBeFunctionCall("lst", [], t0);
            ifStatement = loopInstr.instructions[1];
            expect(ifStatement).toEqual(jasmine.any(Evaluator.If));
            expect(ifStatement.condition).toHaveSameAST("!(i !== " + t0 + ".length)");
            expect(ifStatement.thenCase.length).toEqual(1);
            expect(ifStatement.thenCase[0]).toEqual(jasmine.any(Evaluator.Break));
            expect(ifStatement.elseCase).toEqual([]);
            expect(loopInstr.instructions[2]).toBeFunctionCall(["a", "'push'"], ["i + 1"], t0);
            expect(loopInstr.instructions[3]).toHaveSameAST(t0);
            expect(loopInstr.instructions[4]).toHaveSameAST("i++");
            return expect(loopInstr.instructions[5]).toEqual(jasmine.any(Evaluator.Continue));
          });
          it("uses function scope", function() {
            var bytecode;
            bytecode = getStatementsBytecode("            for (var i = init; i != 0; --i) {              var a = 1 + 2;              function b(c) {d};            };          ");
            expect(bytecode.declaredVariables).toEqual(["i", "a"]);
            expect(bytecode.declaredFunctions.length).toEqual(1);
            return expect(bytecode.declaredFunctions[0]).toBeFunctionDef("b", ["c"], "d", null);
          });
          return it("handles empty expressions in loop definition", function() {
            var bytecode, forLoop;
            bytecode = getStatementsBytecode("for (; b; c) {}");
            expect(bytecode.instructions.length).toEqual(1);
            forLoop = bytecode.instructions[0];
            expect(forLoop).toEqual(jasmine.any(Evaluator.Loop));
            expect(forLoop.instructions.length).toEqual(3);
            expect(forLoop.instructions[0]).toEqual(jasmine.any(Evaluator.If));
            expect(forLoop.instructions[0].condition).toHaveSameAST("!b");
            expect(forLoop.instructions[0].thenCase).toEqual([jasmine.any(Evaluator.Break)]);
            expect(forLoop.instructions[0].elseCase).toEqual([]);
            expect(forLoop.instructions[1]).toEqual("c");
            expect(forLoop.instructions[2]).toEqual(jasmine.any(Evaluator.Continue));
            bytecode = getStatementsBytecode("for (a; ; c) {}");
            expect(bytecode.instructions.length).toEqual(2);
            expect(bytecode.instructions[0]).toEqual("a");
            forLoop = bytecode.instructions[1];
            expect(forLoop).toEqual(jasmine.any(Evaluator.Loop));
            expect(forLoop.instructions.length).toEqual(2);
            expect(forLoop.instructions[0]).toEqual("c");
            expect(forLoop.instructions[1]).toEqual(jasmine.any(Evaluator.Continue));
            bytecode = getStatementsBytecode("for (a; b; ) {}");
            expect(bytecode.instructions.length).toEqual(2);
            expect(bytecode.instructions[0]).toEqual("a");
            forLoop = bytecode.instructions[1];
            expect(forLoop).toEqual(jasmine.any(Evaluator.Loop));
            expect(forLoop.instructions.length).toEqual(2);
            expect(forLoop.instructions[0]).toEqual(jasmine.any(Evaluator.If));
            expect(forLoop.instructions[0].condition).toHaveSameAST("!b");
            expect(forLoop.instructions[0].thenCase).toEqual([jasmine.any(Evaluator.Break)]);
            expect(forLoop.instructions[0].elseCase).toEqual([]);
            return expect(forLoop.instructions[1]).toEqual(jasmine.any(Evaluator.Continue));
          });
        });
        describe("creating Try Catch Finally blocks", function() {
          it("stores the instructions in the try, catch and finally block", function() {
            var bytecode, tryStatement;
            bytecode = getStatementsBytecode("            try {              a = 1; b = a + 'hi';            } catch (err) {              c = 2; d;            } finally {              e + f * g            }          ");
            expect(bytecode.instructions.length).toEqual(1);
            tryStatement = bytecode.instructions[0];
            expect(tryStatement).toEqual(jasmine.any(Evaluator.Try));
            expect(tryStatement.tryBlock).toHaveSameAST(["a = 1", "b = a + 'hi'"]);
            expect(tryStatement.catchBlock).toHaveSameAST(["c = 2", "d"]);
            expect(tryStatement.catchVariable).toEqual("err");
            return expect(tryStatement.finallyBlock).toHaveSameAST(["e + f * g"]);
          });
          it("uses function scope", function() {
            var bytecode;
            bytecode = getStatementsBytecode("            try {              var a;              function b() {}            } catch (e) {              var c;              function d() {}            } finally {              var e;              function f() {}            }          ");
            expect(bytecode.declaredVariables).toEqual(['a', 'c', 'e']);
            expect(bytecode.declaredFunctions.length).toEqual(3);
            expect(bytecode.declaredFunctions[0]).toBeFunctionDef('b', [], '', null);
            expect(bytecode.declaredFunctions[1]).toBeFunctionDef('d', [], '', null);
            return expect(bytecode.declaredFunctions[2]).toBeFunctionDef('f', [], '', null);
          });
          it("handles empty catch blocks", function() {
            var bytecode, tryStatement;
            bytecode = getStatementsBytecode("            try {              a; b;            } finally {              c; d;            }          ");
            expect(bytecode.instructions.length).toEqual(1);
            tryStatement = bytecode.instructions[0];
            expect(tryStatement).toEqual(jasmine.any(Evaluator.Try));
            expect(tryStatement.tryBlock).toHaveSameAST(["a", "b"]);
            expect(tryStatement.catchBlock).toBeNull();
            expect(tryStatement.catchVariable).toBeNull();
            return expect(tryStatement.finallyBlock).toHaveSameAST(["c", "d"]);
          });
          return it("handles empty finally blocks", function() {
            var bytecode, tryStatement;
            bytecode = getStatementsBytecode("            try {              a; b;            } catch(e) {              c; d;            }          ");
            expect(bytecode.instructions.length).toEqual(1);
            tryStatement = bytecode.instructions[0];
            expect(tryStatement).toEqual(jasmine.any(Evaluator.Try));
            expect(tryStatement.tryBlock).toHaveSameAST(["a", "b"]);
            expect(tryStatement.catchBlock).toHaveSameAST(["c", "d"]);
            expect(tryStatement.catchVariable).toEqual("e");
            return expect(tryStatement.finallyBlock).toEqual([]);
          });
        });
        return it("creates Throw statements", function() {
          var bytecode;
          bytecode = getStatementsBytecode("throw 1 + 2");
          expect(bytecode.instructions.length).toEqual(1);
          expect(bytecode.instructions[0]).toEqual(jasmine.any(Evaluator.Throw));
          return expect(bytecode.instructions[0].error).toHaveSameAST("1 + 2");
        });
      });
    });
    return describe("when interpreting bytecode", function() {
      beforeEach(function() {
        return this.addMatchers({
          toEvaluateTo: function(expected, shouldBeError) {
            var didError, evaluated, result,
              _this = this;
            if (shouldBeError == null) {
              shouldBeError = false;
            }
            evaluated = false;
            didError = false;
            result = null;
            evaluator["eval"](this.actual, function(res, didErr) {
              evaluated = true;
              result = res;
              return didError = didErr;
            });
            this.message = function() {
              var actualErrStr, expFormatted, expectErrStr, program, resFormatted;
              expectErrStr = shouldBeError ? "" : "out";
              actualErrStr = didError ? "" : "out";
              if (expected instanceof Error || expected instanceof evaluator.getGlobal("Error")) {
                expFormatted = expected.toString();
              } else {
                expFormatted = jasmine.pp(expected);
              }
              if (result instanceof Error || result instanceof evaluator.getGlobal("Error")) {
                resFormatted = result.toString();
              } else {
                resFormatted = jasmine.pp(result);
              }
              program = _this.actual.replace(/\s+/g, " ");
              return ("Expected '" + program + "' to evaluate to '" + expFormatted + "' with" + expectErrStr + " errors, ") + ("actually evaluated to '" + resFormatted + "' with" + actualErrStr + " errors.");
            };
            return evaluated && this.env.equals_(result, expected) && didError === shouldBeError;
          }
        });
      });
      it("uses its context to evaluate non-function expressions", function() {
        var expressions, inputString, num, outputValue, pair, testId, _i, _len, _results;
        num = 5;
        testId = {
          foo: "foo value",
          bar: "bar value",
          0: "zero value",
          9: "num value"
        };
        evaluator.setGlobal("num", num);
        evaluator.setGlobal("testId", testId);
        expressions = [
          ["'my string'", "my string"], ["true", true], ["null", null], ["123.45", 123.45], ["1.0e2", 1.0e2], ["/regex/", /regex/], ["testId", testId], ["[1, true, 'hi', testId]", [1, true, "hi", testId]], [
            "({a: 1})", {
              a: 1
            }
          ], [
            "({msg: 'hello', arr: [1,2,3], obj: {foo: 'bar'}})", {
              msg: "hello",
              arr: [1, 2, 3],
              obj: {
                foo: "bar"
              }
            }
          ], ["1, 2, 'red', 'blue'", (1, 2, "red", "blue")], ["-num", -5], ["+5", 5], ["!'hey'", false], ["typeof testId", "object"], ["void 'hi'", void 0], ["num in testId", false], ["'0' == false", true], ["foo = 12", 12], ["num += 4", 9], ["foo++", 12], ["++foo", 14], ["true || false", true], ["true ? ' ' : ''", " "], ["testId.foo", "foo value"], ["testId['bar']", "bar value"], ["testId[0]", "zero value"], ["testId[num]", "num value"], ["(1 + 2) * 3", 9], ["false && true || true", true], ["false && (true || true)", false]
        ];
        _results = [];
        for (_i = 0, _len = expressions.length; _i < _len; _i++) {
          pair = expressions[_i];
          inputString = pair[0], outputValue = pair[1];
          _results.push(expect(inputString).toEvaluateTo(outputValue));
        }
        return _results;
      });
      it("conditionally executes code in If blocks", function() {
        var program;
        program = "        a = 0;         if (val) {           a += 1;         } else {           a += 2;         }         a;      ";
        evaluator["eval"]("val = true");
        expect(program).toEvaluateTo(1);
        evaluator["eval"]("val = false");
        return expect(program).toEvaluateTo(2);
      });
      describe("in loops", function() {
        it("can break out", function() {
          var program;
          program = "           a = 0;           while (true) {             break;             a = 1;           }           a;";
          return expect(program).toEvaluateTo(0);
        });
        it("can break out of nested blocks", function() {
          var program;
          program = "           a = 0;           while (true) {             if (true) break;             a = 1;           }           a;";
          expect(program).toEvaluateTo(0);
          program = "           a = 0;           do {             while (true) {               if (true) break;               a += 1;             }             a += 2           } while (false)           a;";
          return expect(program).toEvaluateTo(2);
        });
        it("can continue", function() {
          var program;
          program = "           a = 0;           while (true) {             if (a > 0) break;             a++;             continue;             a = 5;           }           a;";
          return expect(program).toEvaluateTo(1);
        });
        it("can continue in nested blocks", function() {
          var program;
          program = "           a = 0;           while (true) {             if (a > 0) break;             a++;             if (true) continue;             a = 5;           }           a;";
          return expect(program).toEvaluateTo(1);
        });
        return it("repeats normally", function() {
          var program;
          program = "           a = 0;           while (a != 3) {             a++;           }           a;";
          expect(program).toEvaluateTo(3);
          program = "           arr = [1,2,3];           for (i = 0; i < arr.length; i++) {             arr[i] *= arr[i];           }           arr;";
          return expect(program).toEvaluateTo([1, 4, 9]);
        });
      });
      it("checks the predicate when continuing in Do While loops", function() {
        var program;
        program = "         a = 0;         do {           a++;           if (a > 1) break;           continue;         } while (false)         a";
        return expect(program).toEvaluateTo(1);
      });
      it("will call native functions", function() {
        var myNativeFunc;
        myNativeFunc = jasmine.createSpy().andReturn(12);
        evaluator.setGlobal("myNativeFunc", myNativeFunc);
        expect("myNativeFunc('hi', false)").toEvaluateTo(12);
        return expect(myNativeFunc).toHaveBeenCalledWith("hi", false);
      });
      it("can define and call user functions", function() {
        var program;
        program = "         o = {foo: 1};         f = function () {           o.foo += 1;         };         f();         o;";
        return expect(program).toEvaluateTo({
          foo: 2
        });
      });
      it("puts a prototype object on user functions", function() {
        var program;
        program = "        f = function () {};        p = f.prototype;        [p, Object.getPrototypeOf(p) === Object.prototype]; ";
        return expect(program).toEvaluateTo([{}, true]);
      });
      it("prepopulates prototypes on user functions with a construction field", function() {
        var program;
        program = "        f = function () {};        p = f.prototype;        [Object.getOwnPropertyNames(p), p.constructor === f]; ";
        return expect(program).toEvaluateTo([["constructor"], true]);
      });
      it("uses function scope when calling functions", function() {
        var program;
        program = "         a = 1;         b = 2;         c = 3;         f = function (a) {           a += 1;           var b = 6;           c = a + b;         };         f(4);         [a, b, c];";
        evaluator["eval"]("val = 3");
        return expect(program).toEvaluateTo([1, 2, 11]);
      });
      it("can return values", function() {
        var program;
        program = "         increment = function (val) {           return val + 1;         };         increment(5);";
        return expect(program).toEvaluateTo(6);
      });
      it("handles nested functions and has closures", function() {
        var program;
        program = "         counter = function () {           var count = 0;           return function () {             return count++;           };         };         firstCounter = counter();         firstRes = [];         firstRes.push(firstCounter());         firstRes.push(firstCounter());         secondCounter = counter();         secondRes = [];         secondRes.push(secondCounter());         firstRes.push(firstCounter());         secondRes.push(secondCounter());         secondRes.push(secondCounter());         firstRes.push(firstCounter());         firstRes.push(firstCounter());         [firstRes, secondRes]";
        return expect(program).toEvaluateTo([[0, 1, 2, 3, 4], [0, 1, 2]]);
      });
      it("uses enclosing scopes for control blocks", function() {
        var program;
        program = "         f = function (bool, secondBool) {           var a;           if (bool) {             a = 'first';           } else if (secondBool) {             a = 'second';           } else {             a = 'third';           }           return a;         };         [f(true, true), f(true, false), f(false, true), f(false, false)];";
        return expect(program).toEvaluateTo(['first', 'first', 'second', 'third']);
      });
      it("defines declared functions at the beginning of the scope", function() {
        var program;
        program = "         function f() {return 1;}         a = f;         function f() {return 2;}         [a === f, a(), f()];";
        return expect(program).toEvaluateTo([true, 2, 2]);
      });
      it("defines declared functions locally within other functions", function() {
        var program;
        program = "         a = 0;         function f() {           return a();           function a() {return 1;}         }         [a, f()];";
        return expect(program).toEvaluateTo([0, 1]);
      });
      describe("a switch statement", function() {
        it("jumps to the correct case", function() {
          var program;
          program = "           a = 0;           switch (val) {           case 0:             a += 1;             break;           case 1:             a += 2;           case 2:             a += 3;             break;           }           a;";
          evaluator["eval"]("val = 0");
          expect(program).toEvaluateTo(1);
          evaluator["eval"]("val = 1");
          expect(program).toEvaluateTo(5);
          evaluator["eval"]("val = 2");
          expect(program).toEvaluateTo(3);
          evaluator["eval"]("val = 3");
          return expect(program).toEvaluateTo(0);
        });
        it("will use the default case if no other cases match", function() {
          var program;
          program = "          a = 0;          switch (val) {          case 0:            a += 1;          default:            a += 2;          case 1:            a += 3;          }          a;";
          evaluator["eval"]("val = 0");
          expect(program).toEvaluateTo(6);
          evaluator["eval"]("val = 1");
          expect(program).toEvaluateTo(3);
          evaluator["eval"]("val = 2");
          return expect(program).toEvaluateTo(5);
        });
        it("handles only a default case", function() {
          var program;
          program = "          a = 0;          switch (0) {           default:             a++;          }          a;";
          return expect(program).toEvaluateTo(1);
        });
        return it("can continue and return", function() {
          var program;
          program = "          f = function () {            var a = 0;            while (true) {              a++;              switch (a) {                case 1:                  continue;                case 2:                  return a;              }            }          };          f();";
          return expect(program).toEvaluateTo(2);
        });
      });
      describe("short circuits", function() {
        it("case expression evalution", function() {
          var program;
          program = "          obj = {a: 0, b: 0, c: 0};          incr = function (val) {obj[val]++; return val;};          switch('b') {            case incr('a'):            case incr('b'):            case incr('c'):          }          obj";
          return expect(program).toEvaluateTo({
            a: 1,
            b: 1,
            c: 0
          });
        });
        it("logical expression", function() {
          var program;
          program = "          a = 0;          increment = function (val) {a++; return val};          res = increment('') && increment('hi');          [a, res];";
          expect(program).toEvaluateTo([1, '']);
          program = "          a = 0;          increment = function (val) {a++; return val};          res = increment('') && increment('hi') || increment('hello');          [a, res];";
          return expect(program).toEvaluateTo([2, "hello"]);
        });
        return it("ternary expressions", function() {
          var program;
          program = "          obj = {a: 0, b: 0, c: 0};          incr = function (val) {obj[val]++; return val;};          res = incr('a') ? incr('b') : incr('c');          [obj, res];";
          return expect(program).toEvaluateTo([
            {
              a: 1,
              b: 1,
              c: 0
            }, 'b'
          ]);
        });
      });
      it("can delete variables in a scope", function() {
        var program;
        program = "        a = 0;        f = function () {          var arr = [];          var a = 4;          arr.push(a);          delete a;          arr.push(a);          arr.push('a' in window);          delete a;          arr.push('a' in window);          return arr;        };        f();";
        return expect(program).toEvaluateTo([4, 0, true, false]);
      });
      it("prevents over writing of in use temporary variables", function() {
        var program;
        program = "        function makeBools(first, second) {          return [Boolean(first), Boolean(second)];        }        [makeBools(0, '0'), makeBools('null', null)];";
        return expect(program).toEvaluateTo([[false, true], [true, false]]);
      });
      it("sets the function's name as a variable that points to the function inside " + "named function expressions", function() {
        var program;
        program = "        function foo() {return foo;}        a = foo;        foo = 1;        a();";
        expect(program).toEvaluateTo(1);
        program = "        delete foo;" + "bar = function foo() {return foo;};        fooExists = 'foo' in window;        foo = 1;        [bar() === bar, fooExists];";
        return expect(program).toEvaluateTo([true, false]);
      });
      it("extends the environment in With blocks", function() {
        var program;
        program = "        myenv = {a: 1, b: 2};        b = 6;        f = function (env) {          var a = 5;          with (env) {            env = {};            a = 10;            b = 20;          }          return [a, b];        };        [f(myenv), myenv];";
        return expect(program).toEvaluateTo([
          [5, 6], {
            a: 10,
            b: 20
          }
        ]);
      });
      it("can continue, break and return inside with blocks", function() {
        var program;
        program = "        f = function () {          var a = -1;          e = {a: 0};          while (true) {            e.a++;            with (e) {              if (a == 1) continue;              if (a == 2) break;            }          }          with (e) return a;        };        f();";
        return expect(program).toEvaluateTo(2);
      });
      describe("handling errors", function() {
        it("evaluates code in Try blocks", function() {
          var program;
          program = "          a = 0;          try {            a += 1;          } catch (e) {            a += 2;          }          a;";
          return expect(program).toEvaluateTo(1);
        });
        it("evaluates code in Finally blocks", function() {
          var program;
          program = "          a = 0;          try {            a += 1;          } finally {            a += 2;          }          a;";
          return expect(program).toEvaluateTo(3);
        });
        it("can throw custom exceptions", function() {
          var callback;
          callback = jasmine.createSpy();
          evaluator["eval"]("throw 'hello'", callback);
          return expect(callback).toHaveBeenCalledWith('hello', true);
        });
        it("can throw exceptions from nested blocks", function() {
          var program;
          program = "          function throwException() {throw 'my error';}          if (true) {            with ({i: 0}) {              while (i === 0) {                switch (0) {                default:                  throwException();                }                i++;              }            }          }          'foo';";
          return expect(program).toEvaluateTo('my error', true);
        });
        it("can catch thrown exceptions", function() {
          var program;
          program = "          a = 0;          try {            throw 'my error';            a += 1;          } catch (e) {            a += 2;          }          a;";
          return expect(program).toEvaluateTo(2);
        });
        it("can catch exceptions thrown from nested blocks", function() {
          var program;
          program = "          a = 0;          function throwException() {throw 'my error';}          try {            if (true) {              with ({i: 0}) {                while (i === 0) {                  switch (0) {                  default:                    throwException();                  }                  i++;                }              }            }            a += 1;          } catch (e) {            a += 2;          }          a;";
          return expect(program).toEvaluateTo(2);
        });
        it("has a reference to the error in catch blocks", function() {
          var program;
          program = "          a = 0;          try {            throw 2;            a += 1;          } catch (e) {            a += e;          }          a;";
          return expect(program).toEvaluateTo(2);
        });
        it("can throw from within a catch block", function() {
          var program;
          program = "          count = 0;          try {            throw 'my error';          } catch (e) {            count++;            if (count < 2) {              throw 'error with count ' + count;            }          }          'foo';";
          return expect(program).toEvaluateTo('error with count 1', true);
        });
        it("will run the finally block after catching an exception", function() {
          var program;
          program = "          a = 0;          try {            throw 'error';            a += 1;          } catch (e) {            a += 2;          } finally {            a += 4          }          a;";
          return expect(program).toEvaluateTo(6);
        });
        it("will rethrow caught exceptions at the end of the finally if there is no catch block", function() {
          var program;
          program = "          myObj = {val: 0};          try {            throw myObj;            myObj.val += 1;          } finally {            myObj.val += 2;          }          'foo';";
          return expect(program).toEvaluateTo({
            val: 2
          }, true);
        });
        it("does not catch exceptions thrown in the finally block", function() {
          var program;
          program = "          a = 0;          try {          } finally {            a++;            throw a;          }          'foo';";
          return expect(program).toEvaluateTo(1, true);
        });
        it("runs the finally block after the catch block throws an exception", function() {
          var program;
          program = "          myObj = {val: 0};          try {            throw myObj;            myObj.val += 1;          } catch (e) {            throw myObj;            myObj.val += 2          } finally {            myObj.val += 4;          }          'foo';";
          return expect(program).toEvaluateTo({
            val: 4
          }, true);
        });
        it("bubbles up exceptions in the finally block", function() {
          var program;
          program = "          try {            throw 'error in try';          } catch (e) {            throw 'error in catch';          } finally {            throw 'error in finally';          }          'foo';";
          expect(program).toEvaluateTo('error in finally', true);
          program = "          try {            throw 'error in try';          } finally {            throw 'error in finally';          }          'foo';";
          return expect(program).toEvaluateTo('error in finally', true);
        });
        it("can continue, break, and return from inside a try", function() {
          var program;
          program = "          f = function () {            a = 0;            while (a < 3) {              try {                a++;                if (a === 1) {                  continue;                } else if (a === 2) {                  break;                }              } catch (e) {}            }            try {              return a            } catch (e) {}          };          f();";
          return expect(program).toEvaluateTo(2);
        });
        it("can continue, break, and return from inside a catch", function() {
          var program;
          program = "          f = function () {            a = 0;            while (a < 3) {              try {                throw 'foo'              } catch (e) {                a++;                if (a === 1) {                  continue;                } else if (a === 2) {                  break;                }              }            }            try {              return a            } catch (e) {}          };          f();";
          return expect(program).toEvaluateTo(2);
        });
        it("can continue, break, and return from inside a finally", function() {
          var program;
          program = "          f = function () {            a = 0;            while (a < 3) {              try {              } finally {                a++;                if (a === 1) {                  continue;                } else if (a === 2) {                  break;                }              }            }            try {              return a            } catch (e) {}          };          f();";
          expect(program).toEvaluateTo(2);
          program = "          f = function () {            a = 0;            while (a < 3) {              try {                throw 'my error';              } finally {                a++;                if (a === 1) {                  continue;                } else if (a === 2) {                  break;                }              }            }            try {              return a            } catch (e) {}          };          f();";
          return expect(program).toEvaluateTo(2);
        });
        it("can throw native exceptions", function() {
          var err, myerr, program, _i, _len, _ref, _results;
          program = "          delete foo;          foo;";
          expect(program).toEvaluateTo(jasmine.any(evaluator.getGlobal("ReferenceError")), true);
          evaluator.setGlobal("throwError", function() {
            throw myerr;
          });
          _ref = [
            "my error", {
              message: "my message"
            }, 5, true
          ];
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            err = _ref[_i];
            myerr = err;
            _results.push(expect("throwError();").toEvaluateTo(myerr, true));
          }
          return _results;
        });
        it("can catch native exceptions", function() {
          var program;
          program = "          delete foo;          myerr = null;          try {            foo;          } catch (e) {            myerr = e;          }          myerr;";
          return expect(program).toEvaluateTo(jasmine.any(evaluator.getGlobal("ReferenceError")));
        });
        return it("doesn't have a stack trace", function() {
          var program;
          program = "          delete foo;          myerr = null;          try {            foo;          } catch (e) {            myerr = e;          }          [myerr.name, myerr.message, myerr.stack];";
          expect(program).toEvaluateTo(['ReferenceError', jasmine.any(String), null]);
          evaluator.setGlobal("throwReferenceError", function() {
            return foo;
          });
          program = "          delete foo;          try {            throwReferenceError();          } catch (e) {            myerr = e;          }          [myerr.name, myerr.message, myerr.stack];";
          return expect(program).toEvaluateTo(['ReferenceError', jasmine.any(String), null]);
        });
      });
      describe("the 'this' keyword", function() {
        it("has the proper value in user defined functions", function() {
          var program;
          program = "          val = 0;          inc = function () {this.val++};          inc();          val;";
          expect(program).toEvaluateTo(1);
          program = "          a = {            val: 0,            inc: function () {this.val++}          };          a.inc();          a.val;";
          expect(program).toEvaluateTo(1);
          program = "          val = 0;          a = {            val: 0,            inc: function () {this.val++}          };          a.inc();          incCopy = a.inc;          incCopy();          incCopy();          [val, a.val];";
          return expect(program).toEvaluateTo([2, 1]);
        });
        return it("has the proper value in native functions", function() {
          var inc, program;
          inc = function() {
            return this.val++;
          };
          evaluator.setGlobal("inc", inc);
          program = "          val = 0;          inc();          val;";
          expect(program).toEvaluateTo(1);
          program = "          a = {            val: 0,            inc: inc          };          a.inc();          a.val;";
          expect(program).toEvaluateTo(1);
          program = "          val = 0;          a = {            val: 0,            inc: inc          };          a.inc();          incCopy = a.inc;          incCopy();          incCopy();          [val, a.val];";
          return expect(program).toEvaluateTo([2, 1]);
        });
      });
      describe("the 'arguments' variable", function() {
        describe("in user defined functions", function() {
          var getArgs;
          getArgs = null;
          beforeEach(function() {
            evaluator["eval"]("getArgs = function () {return arguments;};");
            getArgs = evaluator.getGlobal("getArgs");
            return expect(getArgs).not.toBeNull();
          });
          it("acts as an array of the arguments passed in", function() {
            return expect("getArgs(1, 'hi', {}, false);").toEvaluateTo([1, 'hi', {}, false]);
          });
          it("defines the arguments even if there is a variable of the same name", function() {
            var program;
            program = "            f = function () {              var arguments;              return arguments;            };            f(1, 2, 3); ";
            return expect(program).toEvaluateTo([1, 2, 3]);
          });
          it("has the correct length field", function() {
            expect("getArgs(1, 2).length").toEvaluateTo(2);
            return expect("getArgs(1, 2, [], true).length").toEvaluateTo(4);
          });
          return it("stores a reference to the function being called", function() {
            return expect("getArgs().callee").toEvaluateTo(getArgs);
          });
        });
        return describe("in native functions", function() {
          var getArgs;
          getArgs = function() {
            return arguments;
          };
          beforeEach(function() {
            return evaluator.setGlobal("getArgs", getArgs);
          });
          it("acts as an array of the arguments passed in", function() {
            return expect("getArgs(1, 'hi', {}, false);").toEvaluateTo([1, 'hi', {}, false]);
          });
          it("has the correct length field", function() {
            expect("getArgs(1, 2).length").toEvaluateTo(2);
            return expect("getArgs(1, 2, [], true).length").toEvaluateTo(4);
          });
          return it("stores a reference to the function being called", function() {
            return expect("getArgs().callee").toEvaluateTo(getArgs);
          });
        });
      });
      it("works as expected inside method calls", function() {
        var program;
        program = "        obj = {          val: 'my val',          getVal: function () {            return this.val;          },          f: function (num) {            a = [];            a.push(new Object());            if (num > 2) {              a.push('yes');            }            switch (num) {              case -1:                a.push('no');              default:                a.push('switch');            }            a.push(this.getVal());            throw a;          }        };        obj.f(3); ";
        return expect(program).toEvaluateTo([{}, "yes", "switch", "my val"], true);
      });
      describe("creating instances", function() {
        describe("from user defined functions", function() {
          it("calls the constructor with the instance as 'this'", function() {
            var program;
            program = "            function Cls(arg) {              this.foo = 'hi';              this.bar = 'there';              this.myarg = arg;            }            instance = new Cls(5);            [instance.foo, instance.bar, instance.myarg]; ";
            return expect(program).toEvaluateTo(["hi", "there", 5]);
          });
          it("handles constructors that return a value", function() {
            var program;
            program = "            function Cls() {              this.foo = 'bar';              return 5;            }            instance = new Cls();            instance.foo; ";
            return expect(program).toEvaluateTo("bar");
          });
          it("bubbles up exceptions thrown in the constructor", function() {
            var program;
            program = "            function Cls() {              throw 'my error';            }            new Cls(); ";
            return expect(program).toEvaluateTo("my error", true);
          });
          return it("sets the prototype properly", function() {
            var program;
            program = "            function Cls() {}            Cls.prototype.foo = 'hi';            Cls.prototype.bar = 'there';            a = new Cls();            b = new Cls();            initial = [a.foo, a.bar, b.foo, b.bar];            a.foo = 1;            a.bar = 2;            Cls.prototype.foo = 3;            Cls.prototype.bar = 4;            [initial, [a.foo, a.bar, b.foo, b.bar]]; ";
            return expect(program).toEvaluateTo([["hi", "there", "hi", "there"], [1, 2, 3, 4]]);
          });
        });
        return describe("from native functions", function() {
          it("calls the native function", function() {
            var program;
            evaluator.setGlobal("Cls", function(arg) {
              this.foo = 'hi';
              this.bar = 'there';
              return this.myarg = arg;
            });
            program = "            instance = new Cls(5);            [instance.foo, instance.bar, instance.myarg]; ";
            return expect(program).toEvaluateTo(["hi", "there", 5]);
          });
          it("handles constructors that return a value", function() {
            var program;
            evaluator.setGlobal("Cls", function() {
              this.foo = "bar";
              return 5;
            });
            program = "            instance = new Cls();            instance.foo; ";
            return expect(program).toEvaluateTo("bar");
          });
          it("bubbles up exceptions thrown in the constructor", function() {
            var myError, program;
            myError = "my error";
            evaluator.setGlobal("Cls", function() {
              throw myError;
            });
            program = "            new Cls(); ";
            return expect(program).toEvaluateTo(myError, true);
          });
          return it("sets the prototype properly", function() {
            var program;
            evaluator.setGlobal("Cls", function() {});
            program = "            Cls.prototype.foo = 'hi';            Cls.prototype.bar = 'there';            a = new Cls();            b = new Cls();            initial = [a.foo, a.bar, b.foo, b.bar];            a.foo = 1;            a.bar = 2;            Cls.prototype.foo = 3;            Cls.prototype.bar = 4;            [initial, [a.foo, a.bar, b.foo, b.bar]]; ";
            return expect(program).toEvaluateTo([["hi", "there", "hi", "there"], [1, 2, 3, 4]]);
          });
        });
      });
      describe("pausing execution", function() {
        var callback, context, returnValue;
        context = returnValue = callback = null;
        beforeEach(function() {
          returnValue = null;
          evaluator.setGlobal("pauseExecFunc", function() {
            context = evaluator.pause();
            return returnValue;
          });
          return callback = jasmine.createSpy();
        });
        it("won't call onComplete before execution finishes", function() {
          var program;
          program = "          pauseExecFunc();          5;";
          callback = jasmine.createSpy();
          evaluator["eval"](program, callback);
          return expect(callback).not.toHaveBeenCalled();
        });
        it("requires a context to resume execution", function() {
          var errorMessage, myObject, program;
          evaluator.setGlobal("myObject", myObject = {
            val: 0
          });
          program = "          f = function () {            myObject.val = 1;            pauseExecFunc();            myObject.val = 2;          };          f();          pauseExecFunc();          myObject.val = 3;";
          evaluator["eval"](program);
          expect(myObject.val).toEqual(1);
          errorMessage = "Resuming evaluation requires a context as returned by pause.";
          expect(function() {
            return evaluator.resume();
          }).toThrow(errorMessage);
          expect(myObject.val).toEqual(1);
          evaluator.resume(context);
          expect(myObject.val).toEqual(2);
          expect(function() {
            return evaluator.resume({});
          }).toThrow("Invalid context given to resume.");
          expect(myObject.val).toEqual(2);
          evaluator.resume(context);
          return expect(myObject.val).toEqual(3);
        });
        it("can resume into different contexts", function() {
          var context1, context2, obj1, obj2, program1, program2;
          evaluator.setGlobal("obj1", obj1 = {
            val: 0
          });
          evaluator.setGlobal("obj2", obj2 = {
            val: 0
          });
          program1 = "f = function () {            obj1.val = 1;            pauseExecFunc();            obj1.val = 2;          };          f();          pauseExecFunc();          obj1.val = 3;";
          program2 = "f = function () {            obj2.val = 1;            pauseExecFunc();            obj2.val = 2;          };          f();          pauseExecFunc();          obj2.val = 3;";
          evaluator["eval"](program1);
          context1 = context;
          expect(obj1.val).toEqual(1);
          expect(obj2.val).toEqual(0);
          evaluator["eval"](program2);
          context2 = context;
          expect(obj1.val).toEqual(1);
          expect(obj2.val).toEqual(1);
          evaluator.resume(context2);
          expect(obj1.val).toEqual(1);
          expect(obj2.val).toEqual(2);
          evaluator.resume(context1);
          expect(obj1.val).toEqual(2);
          expect(obj2.val).toEqual(2);
          evaluator.resume(context1);
          expect(obj1.val).toEqual(3);
          expect(obj2.val).toEqual(2);
          evaluator.resume(context2);
          expect(obj1.val).toEqual(3);
          return expect(obj2.val).toEqual(3);
        });
        it("calls the onComplete function even after pausing and resuming", function() {
          var program;
          program = "          pauseExecFunc();          'foobar';";
          evaluator["eval"](program, callback);
          expect(callback).not.toHaveBeenCalled();
          evaluator.resume(context);
          return expect(callback).toHaveBeenCalledWith("foobar", false);
        });
        it("handles returned values normally after a pause", function() {
          var program;
          program = "          [            pauseExecFunc(),            pauseExecFunc(),            pauseExecFunc()          ]; ";
          returnValue = "first";
          evaluator["eval"](program, callback);
          returnValue = "second";
          evaluator.resume(context);
          returnValue = "third";
          evaluator.resume(context);
          evaluator.resume(context);
          return expect(callback).toHaveBeenCalledWith(["first", "second", "third"], false);
        });
        it("can set the value returned by a function call that just finished", function() {
          var program;
          program = "          [            pauseExecFunc(),            pauseExecFunc(),            pauseExecFunc(),            pauseExecFunc(),            pauseExecFunc(),            pauseExecFunc(),            pauseExecFunc(),            pauseExecFunc(),            pauseExecFunc()          ]; ";
          evaluator["eval"](program, callback);
          evaluator.resume(context, "first");
          evaluator.resume(context, false);
          evaluator.resume(context, true);
          evaluator.resume(context, 0);
          evaluator.resume(context, 1);
          evaluator.resume(context, {
            foo: "bar"
          });
          evaluator.resume(context, [1, 2, 3]);
          evaluator.resume(context, void 0);
          evaluator.resume(context, null);
          return expect(callback).toHaveBeenCalledWith([
            "first", false, true, 0, 1, {
              foo: "bar"
            }, [1, 2, 3], void 0, null
          ], false);
        });
        it("can throw an error thrown by a function call the just finished", function() {
          var error;
          evaluator["eval"]("pauseExecFunc();", callback);
          error = new Error("This is an error");
          evaluator.resume(context, error, true);
          return expect(callback).toHaveBeenCalledWith(error, true);
        });
        it("prevents temporary variables in different contexts from colliding", function() {
          var callback1, callback2, context1, context2, program;
          program = "          [            pauseExecFunc(),            pauseExecFunc(),            pauseExecFunc()          ]; ";
          callback1 = jasmine.createSpy("First Callback");
          callback2 = jasmine.createSpy("Second Callback");
          evaluator["eval"](program, callback1);
          context1 = context;
          evaluator.resume(context1, "first");
          evaluator.resume(context1, "second");
          evaluator["eval"](program, callback2);
          context2 = context;
          evaluator.resume(context2, "first");
          evaluator.resume(context1, "third");
          expect(callback1).toHaveBeenCalledWith(["first", "second", "third"], false);
          evaluator.resume(context2, "second");
          evaluator.resume(context2, "third");
          return expect(callback2).toHaveBeenCalledWith(["first", "second", "third"], false);
        });
        it("can be paused multiple times and resumed multiple times in a row", function() {
          var context1, context2;
          context1 = context2 = null;
          evaluator.setGlobal("pause", function() {
            context1 = evaluator.pause();
            return context2 = evaluator.pause();
          });
          evaluator["eval"]("pause(); 'foo';", callback);
          evaluator.resume(context2);
          expect(callback).not.toHaveBeenCalled();
          evaluator.resume(context1);
          return expect(callback).toHaveBeenCalledWith("foo", false);
        });
        return it("can pause and resume when there is nothing being executed", function() {
          evaluator.resume(evaluator.pause());
          evaluator["eval"]("'foo';", callback);
          expect(callback).toHaveBeenCalled();
          callback.reset();
          evaluator.resume(evaluator.pause());
          return expect(callback).not.toHaveBeenCalled();
        });
      });
      describe("calling user functions from native functions", function() {
        it("works when there is no context", function() {
          var userFunction;
          evaluator.setGlobal("value", 0);
          userFunction = null;
          evaluator["eval"]("(function (incr) {value += incr});", function(result) {
            return userFunction = result;
          });
          expect(userFunction).not.toBeNull();
          userFunction(3);
          expect(evaluator.getGlobal("value")).toEqual(3);
          userFunction(1);
          return expect(evaluator.getGlobal("value")).toEqual(4);
        });
        it("returns values from user functions", function() {
          var userFunction;
          evaluator.setGlobal("value", 0);
          userFunction = null;
          evaluator["eval"]("(function (incr) {return value += incr});", function(result) {
            return userFunction = result;
          });
          expect(userFunction).not.toBeNull();
          expect(userFunction(3)).toEqual(3);
          return expect(userFunction(1)).toEqual(4);
        });
        it("does not interfere with existing execution contexts", function() {
          var program;
          evaluator.setGlobal("arr", []);
          evaluator.setGlobal("callFunction", function(func) {
            evaluator.getGlobal("arr").push("native before call");
            func();
            return evaluator.getGlobal("arr").push("native after call");
          });
          program = "          f = function () {            arr.push('user in call');          };          arr.push('user before call');          callFunction(f);          arr.push('user after call');          arr;        ";
          return expect(program).toEvaluateTo(["user before call", "native before call", "user in call", "native after call", "user after call"]);
        });
        it("bubbles up exceptions to native caller", function() {
          var userFunction;
          userFunction = null;
          evaluator["eval"]("(function () {throw 'my error'});", function(result) {
            return userFunction = result;
          });
          return expect(userFunction).toThrow("my error");
        });
        return it("won't restart paused execution", function() {
          var callback, context, program;
          context = null;
          evaluator.setGlobal("pause", function() {
            return context = evaluator.pause();
          });
          callback = jasmine.createSpy();
          program = "          val = 0;          /* Make sure multiple instructions work */          f = function () {val++; val++; val++};          pause();          val; ";
          evaluator["eval"](program, callback);
          evaluator.getGlobal('f')();
          expect(callback).not.toHaveBeenCalled();
          evaluator.resume(context);
          return expect(callback).toHaveBeenCalledWith(3, false);
        });
      });
      return it("returns undefined from var'ed assignments", function() {
        return expect("var a = 1;").toEvaluateTo(void 0);
      });
    });
  });

}).call(this);
